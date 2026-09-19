/**
 * A small in-memory WebUSB device used by the tests.
 *
 * It is not a cycle-accurate DFU implementation, but it models the states and
 * transfer semantics the session relies on: SET_ADDRESS, sector/mass erase,
 * block writes with auto-increment, uploads, option bytes, stalls, error
 * states and mid-operation failure injection.
 */

import { DfuRequest, DfuState, DfuStatusCode, GD32_DFU_PRODUCT_ID, GD32_VENDOR_ID } from '../dfu/codes';
import type {
  UsbControlSetup,
  UsbDeviceLike,
  UsbInTransferResult,
  UsbOutTransferResult,
} from '../dfu/usb';

export interface MockDeviceOptions {
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
  flashBase?: number;
  flashSize?: number;
  pageSize?: number;
  initialFlash?: Uint8Array;
  optionByteBase?: number;
  strings?: Record<number, string>;
}

function toBytes(data: Uint8Array | undefined): Uint8Array {
  if (data === undefined) return new Uint8Array(0);
  return data;
}

function littleEndian(bytes: Uint8Array): number {
  return (bytes[0] ?? 0) | ((bytes[1] ?? 0) << 8) | ((bytes[2] ?? 0) << 16) | ((bytes[3] ?? 0) << 24);
}

export class MockDfuDevice implements UsbDeviceLike {
  readonly vendorId: number;
  readonly productId: number;
  serialNumber?: string;

  opened = false;
  claimed = false;
  configuration: { configurationValue: number } | null = null;

  readonly flashBase: number;
  readonly flash: Uint8Array;
  readonly pageSize: number;
  readonly optionByteBase: number;
  readonly optionBytes = new Uint8Array(16).fill(0xff);
  readonly strings: Record<number, string>;

  state: DfuState = DfuState.DfuIdle;
  errorCode: DfuStatusCode = DfuStatusCode.Ok;
  pointer = 0;

  writeOps: { address: number; length: number }[] = [];
  eraseOps: number[] = [];
  massEraseCount = 0;

  private busyRemaining = 0;
  private stalls = new Set<number>();
  private failWriteAt: number | null = null;
  private failWriteCode = DfuStatusCode.ErrWrite;

  constructor(options: MockDeviceOptions = {}) {
    this.vendorId = options.vendorId ?? GD32_VENDOR_ID;
    this.productId = options.productId ?? GD32_DFU_PRODUCT_ID;
    this.serialNumber = options.serialNumber;
    this.flashBase = options.flashBase ?? 0x0800_0000;
    this.pageSize = options.pageSize ?? 1024;
    this.optionByteBase = options.optionByteBase ?? 0x1fff_f800;
    const size = options.flashSize ?? 128 * 1024;
    this.flash = options.initialFlash?.slice() ?? new Uint8Array(size).fill(0xff);
    this.strings = options.strings ?? {};
  }

  // --- test controls ------------------------------------------------------

  setStall(request: DfuRequest, stall = true): void {
    if (stall) this.stalls.add(request);
    else this.stalls.delete(request);
  }

  failWriteAtNext(address: number, code: DfuStatusCode = DfuStatusCode.ErrWrite): void {
    this.failWriteAt = address;
    this.failWriteCode = code;
  }

  corrupt(address: number, value: number): void {
    if (this.isFlashAddress(address)) {
      this.flash[address - this.flashBase] = value & 0xff;
    } else if (this.isOptionAddress(address)) {
      this.optionBytes[address - this.optionByteBase] = value & 0xff;
    }
  }

  read(address: number, length: number): Uint8Array {
    if (this.isFlashAddress(address)) {
      return this.flash.slice(address - this.flashBase, address - this.flashBase + length);
    }
    if (this.isOptionAddress(address)) {
      return this.optionBytes.slice(address - this.optionByteBase, address - this.optionByteBase + length);
    }
    return new Uint8Array(length).fill(0xff);
  }

  // --- UsbDeviceLike ------------------------------------------------------

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
  }

  async selectConfiguration(configurationValue: number): Promise<void> {
    this.configuration = { configurationValue };
  }

  async claimInterface(): Promise<void> {
    this.claimed = true;
  }

  async releaseInterface(): Promise<void> {
    this.claimed = false;
  }

  async controlTransferIn(setup: UsbControlSetup, length: number): Promise<UsbInTransferResult> {
    this.ensureOpen();
    if (this.stalls.has(setup.request)) return { status: 'stall' };

    if (setup.request === DfuRequest.GetStatus && setup.requestType === 'class') {
      const data = this.buildStatus();
      return { status: 'ok', data: new DataView(data.buffer, data.byteOffset, data.byteLength) };
    }

    if (setup.request === DfuRequest.Upload && setup.requestType === 'class') {
      if (this.state !== DfuState.DfuIdle) return { status: 'stall' };
      const data = this.read(this.pointer, length);
      this.pointer = (this.pointer + length) >>> 0;
      this.state = DfuState.DfuUploadIdle;
      return { status: 'ok', data: new DataView(data.buffer, data.byteOffset, data.byteLength) };
    }

    if (setup.request === 0x06 && setup.requestType === 'standard') {
      const index = setup.value & 0xff;
      const value = this.strings[index];
      if (value === undefined) return { status: 'stall' };
      return { status: 'ok', data: this.encodeString(value) };
    }

    return { status: 'stall' };
  }

  async controlTransferOut(setup: UsbControlSetup, data?: Uint8Array): Promise<UsbOutTransferResult> {
    this.ensureOpen();
    if (this.stalls.has(setup.request)) return { status: 'stall' };

    if (setup.request === DfuRequest.ClearStatus) {
      this.state = DfuState.DfuIdle;
      this.errorCode = DfuStatusCode.Ok;
      return { status: 'ok' };
    }
    if (setup.request === DfuRequest.Abort) {
      this.state = DfuState.DfuIdle;
      this.errorCode = DfuStatusCode.Ok;
      return { status: 'ok' };
    }

    if (setup.request === DfuRequest.Download) {
      // While in dfuERROR every request except CLRSTATUS/GETSTATUS stalls.
      if (this.state === DfuState.DfuError) return { status: 'stall' };
      this.handleDownload(setup.value, toBytes(data));
      return { status: 'ok' };
    }

    return { status: 'stall' };
  }

  // --- internals ----------------------------------------------------------

  private ensureOpen(): void {
    if (!this.opened) throw new Error('The USB device was disconnected.');
  }

  private isFlashAddress(address: number): boolean {
    return address >= this.flashBase && address < this.flashBase + this.flash.length;
  }

  private isOptionAddress(address: number): boolean {
    return address >= this.optionByteBase && address < this.optionByteBase + this.optionBytes.length;
  }

  private acceptCommand(): void {
    this.state = DfuState.DfuDownloadBusy;
    this.busyRemaining = 1;
    this.errorCode = DfuStatusCode.Ok;
  }

  private writeMemory(address: number, bytes: Uint8Array): void {
    if (this.isFlashAddress(address)) {
      this.flash.set(bytes, address - this.flashBase);
      return;
    }
    if (this.isOptionAddress(address)) {
      this.optionBytes.set(bytes, address - this.optionByteBase);
      return;
    }
    throw new Error(`Write outside mapped memory at 0x${address.toString(16)}.`);
  }

  private handleDownload(blockNumber: number, data: Uint8Array): void {
    if (blockNumber === 0) {
      if (data.length === 0) {
        this.state = DfuState.DfuIdle;
        return;
      }
      const command = data[0];
      if (command === 0x21) {
        this.pointer = littleEndian(data.subarray(1, 5)) >>> 0;
        this.acceptCommand();
        return;
      }
      if (command === 0x41) {
        if (data.length === 1) {
          this.flash.fill(0xff);
          this.massEraseCount++;
        } else {
          const address = littleEndian(data.subarray(1, 5)) >>> 0;
          this.eraseOps.push(address);
          if (this.isFlashAddress(address)) {
            this.flash.fill(0xff, address - this.flashBase, address - this.flashBase + this.pageSize);
          } else if (this.isOptionAddress(address)) {
            this.optionBytes.fill(0xff);
          }
        }
        this.acceptCommand();
        return;
      }
      throw new Error(`Unknown DfuSe command 0x${command.toString(16)}.`);
    }

    if (blockNumber === 2) {
      if (this.failWriteAt !== null && this.pointer === this.failWriteAt) {
        this.errorCode = this.failWriteCode;
        this.state = DfuState.DfuError;
        return;
      }
      this.writeMemory(this.pointer, data);
      this.writeOps.push({ address: this.pointer, length: data.length });
      this.pointer = (this.pointer + data.length) >>> 0;
      this.acceptCommand();
      return;
    }
  }

  private buildStatus(): Uint8Array {
    if (this.state === DfuState.DfuDownloadBusy && this.busyRemaining > 0) {
      this.busyRemaining--;
      if (this.busyRemaining === 0) {
        this.state = DfuState.DfuDownloadIdle;
      }
    }
    return new Uint8Array([
      this.errorCode,
      1,
      0,
      0,
      this.state,
      0,
    ]);
  }

  private encodeString(value: string): DataView {
    const bytes = new Uint8Array(2 + value.length * 2);
    bytes[0] = bytes.length;
    bytes[1] = 0x03;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      bytes[2 + index * 2] = code & 0xff;
      bytes[3 + index * 2] = (code >> 8) & 0xff;
    }
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
}
