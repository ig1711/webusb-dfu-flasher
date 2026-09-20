/**
 * GD32 flash bootloader DFU / DfuSe session.
 *
 * Owns the USB state machine. Every method that touches flash validates its
 * inputs first and asserts the DFU status code after each transition, so a
 * transport-level "ok" can never be mistaken for a successful operation.
 */

import {
  DfuRequest,
  DfuSeCommand,
  DfuState,
  DfuStatusCode,
  GD32_DFU_PRODUCT_ID,
  GD32_VENDOR_ID,
  OPTION_BYTE_LENGTH,
  TIMEOUTS,
  TRANSFER_BLOCK_SIZE,
} from './codes';
import {
  DisconnectedError,
  DfuError,
  DfuStatusError,
  OperationAbortedError,
  PartialWriteError,
  StallError,
  TimeoutError,
  TransportError,
  ValidationError,
  VerificationError,
  isAbortError,
  isDfuError,
} from './errors';
import {
  decodeOptionBytes,
  type F350OptionBytes,
} from './optionBytes';
import {
  assertAppRange,
  assertFlashRange,
  assertPageAligned,
  formatAddress,
  pagesForRange,
  type FlashGeometry,
} from './validate';
import {
  defaultRequestDevice,
  deviceFilter,
  type RequestDeviceFn,
  type UsbControlSetup,
  type UsbDeviceLike,
} from './usb';
import { assertFirmwareFits, type FirmwareImage } from '../firmware/image';

export interface DfuStatus {
  code: DfuStatusCode;
  pollTimeout: number;
  state: DfuState;
  iString: number;
}

export type ProgressPhase = 'erase' | 'write' | 'verify' | 'read';

export interface ProgressUpdate {
  phase: ProgressPhase;
  percent: number;
  bytesDone: number;
  bytesTotal: number;
  address: number;
}

export interface DfuSessionOptions {
  requestDevice?: RequestDeviceFn;
  transferBlockSize?: number;
  logger?: (message: string) => void;
}

export interface WriteImageOptions {
  eraseFirst?: boolean;
  onProgress?: (update: ProgressUpdate) => void;
  signal?: AbortSignal;
}

const MAX_ABS_ADDRESS = 0xffff_ffff;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OperationAbortedError();
}

function wrapUsbError(error: unknown, context: string): DfuError {
  if (error instanceof DfuError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new OperationAbortedError();
  }
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (
    normalized.includes('disconnect') ||
    normalized.includes('device unavailable') ||
    normalized.includes('not found') ||
    normalized.includes('no device')
  ) {
    return new DisconnectedError(`${context}: ${message}`);
  }
  return new TransportError(`${context}: ${message}`, undefined, { cause: error });
}

export class DfuSession {
  private device: UsbDeviceLike | null = null;
  private interfaceNumber = 0;
  private assumedState: DfuState | null = null;
  private readonly transferBlockSize: number;
  private readonly requestDevice: RequestDeviceFn;
  private readonly logger: (message: string) => void;

  constructor(options: DfuSessionOptions = {}) {
    this.requestDevice = options.requestDevice ?? defaultRequestDevice;
    this.transferBlockSize = options.transferBlockSize ?? TRANSFER_BLOCK_SIZE;
    this.logger = options.logger ?? (() => {});
  }

  get connected(): boolean {
    return this.device !== null;
  }

  get blockSize(): number {
    return this.transferBlockSize;
  }

  get usbDevice(): UsbDeviceLike | null {
    return this.device;
  }

  // --- connection ---------------------------------------------------------

  async open(): Promise<UsbDeviceLike> {
    const device = await this.requestDevice({ filters: deviceFilter() });
    if (device.vendorId !== GD32_VENDOR_ID || device.productId !== GD32_DFU_PRODUCT_ID) {
      throw new ValidationError(
        `Refusing to use USB device ${device.vendorId.toString(16)}:${device.productId.toString(16)}; ` +
          `only ${GD32_VENDOR_ID.toString(16)}:${GD32_DFU_PRODUCT_ID.toString(16)} is supported.`,
      );
    }

    try {
      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      await device.claimInterface(this.interfaceNumber);
    } catch (error) {
      await this.safeClose(device);
      throw wrapUsbError(error, 'Opening the DFU device');
    }

    this.device = device;
    this.assumedState = null;
    await this.recoverToIdle();
    this.logger('Device opened and returned to dfuIDLE.');
    return device;
  }

  async close(): Promise<void> {
    const device = this.device;
    this.device = null;
    this.assumedState = null;
    if (device) await this.safeClose(device);
  }

  private async safeClose(device: UsbDeviceLike): Promise<void> {
    try {
      await device.releaseInterface(this.interfaceNumber);
    } catch {
      // best effort
    }
    try {
      await device.close();
    } catch {
      // best effort
    }
  }

  private requireDevice(): UsbDeviceLike {
    if (!this.device) throw new DisconnectedError('No DFU device is connected.');
    return this.device;
  }

  // --- low-level transfers ------------------------------------------------

  private classSetup(request: DfuRequest, value = 0): UsbControlSetup {
    return {
      requestType: 'class',
      recipient: 'interface',
      request,
      value,
      index: this.interfaceNumber,
    };
  }

  private async controlIn(setup: UsbControlSetup, length: number, context: string): Promise<DataView> {
    const device = this.requireDevice();
    let result;
    try {
      result = await device.controlTransferIn(setup, length);
    } catch (error) {
      this.assumedState = null;
      throw wrapUsbError(error, context);
    }
    if (result.status === 'stall') {
      this.assumedState = null;
      throw new StallError(`${context}: the device stalled the request.`);
    }
    if (result.status !== 'ok' || !result.data) {
      this.assumedState = null;
      throw new TransportError(`${context}: transfer status "${result.status}" with no data.`, result.status);
    }
    return result.data;
  }

  private async controlOut(setup: UsbControlSetup, data: Uint8Array | undefined, context: string): Promise<void> {
    const device = this.requireDevice();
    let result;
    try {
      result = await device.controlTransferOut(setup, data);
    } catch (error) {
      this.assumedState = null;
      throw wrapUsbError(error, context);
    }
    if (result.status !== 'ok') {
      this.assumedState = null;
      throw new StallError(`${context}: the device stalled the request.`);
    }
  }

  // --- status / state machine --------------------------------------------

  async readStatus(): Promise<DfuStatus> {
    const data = await this.controlIn(this.classSetup(DfuRequest.GetStatus), 6, 'GETSTATUS');
    if (data.byteLength < 6) {
      throw new TransportError(`GETSTATUS returned ${data.byteLength} byte(s); expected 6.`);
    }
    const pollTimeout = Math.max(
      data.getUint8(1) | (data.getUint8(2) << 8) | (data.getUint8(3) << 16),
      5,
    );
    const status: DfuStatus = {
      code: data.getUint8(0),
      pollTimeout,
      state: data.getUint8(4),
      iString: data.getUint8(5),
    };
    this.assumedState = status.state;
    return status;
  }

  private assertStatusOk(status: DfuStatus, context: string): void {
    if (status.code !== DfuStatusCode.Ok) {
      throw new DfuStatusError(status.code, context);
    }
  }

  async dismissError(): Promise<void> {
    try {
      await this.controlOut(this.classSetup(DfuRequest.ClearStatus), undefined, 'CLRSTATUS');
    } catch {
      // best effort; state will be re-checked by the caller
    }
    this.assumedState = DfuState.DfuIdle;
  }

  private async sendAbort(): Promise<void> {
    await this.controlOut(this.classSetup(DfuRequest.Abort), undefined, 'ABORT');
    this.assumedState = DfuState.DfuIdle;
  }

  async awaitState(target: DfuState, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const status = await this.readStatus();
      if (status.state === target) return true;
      if (status.state === DfuState.DfuError) {
        await this.dismissError();
      }
      if (Date.now() >= deadline) return false;
      await delay(Math.min(Math.max(status.pollTimeout, 5), 500));
    }
  }

  /** Poll after a DNLOAD until it has been processed, asserting the status. */
  private async awaitDownloadComplete(timeoutMs: number, context: string): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let sawBusy = false;
    for (;;) {
      const status = await this.readStatus();
      if (status.state === DfuState.DfuDownloadBusy || status.state === DfuState.DfuDownloadSync) {
        sawBusy = true;
        this.assertStatusOk(status, context);
      } else if (status.state === DfuState.DfuDownloadIdle) {
        this.assertStatusOk(status, context);
        return;
      } else if (status.state === DfuState.DfuIdle && sawBusy) {
        this.assertStatusOk(status, context);
        return;
      } else {
        this.assertStatusOk(status, context);
      }
      if (Date.now() >= deadline) {
        throw new TimeoutError(`${context}: timed out after ${timeoutMs} ms.`);
      }
      await delay(Math.min(Math.max(status.pollTimeout, 5), 500));
    }
  }

  async recoverToIdle(): Promise<void> {
    if (this.assumedState === DfuState.DfuIdle) return;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const status = await this.readStatus();
        if (status.state === DfuState.DfuIdle) return;
        if (status.state === DfuState.DfuError || status.code !== DfuStatusCode.Ok) {
          await this.dismissError();
        } else {
          await this.sendAbort();
        }
        if (await this.awaitState(DfuState.DfuIdle, TIMEOUTS.idleRecovery)) return;
      } catch (error) {
        this.assumedState = null;
        if (isAbortError(error)) throw error;
        if (!isDfuError(error) || error.kind === 'disconnected') throw error;
      }
      await delay(20);
    }
    throw new DfuError('Could not return the device to dfuIDLE after multiple attempts.', 'transport');
  }

  private async abortToIdle(): Promise<void> {
    await this.sendAbort();
    if (await this.awaitState(DfuState.DfuIdle, TIMEOUTS.idleRecovery)) return;
    await this.dismissError();
    if (!(await this.awaitState(DfuState.DfuIdle, TIMEOUTS.idleRecovery))) {
      throw new TimeoutError('The device did not return to dfuIDLE after ABORT.');
    }
  }

  // --- DfuSe operations ---------------------------------------------------

  private async sendBlock(blockNumber: number, data: Uint8Array): Promise<void> {
    const setup = this.classSetup(DfuRequest.Download, blockNumber);
    await this.controlOut(setup, data, `DNLOAD block ${blockNumber}`);
    this.assumedState = null; // unknown until the next GETSTATUS
  }

  private async receiveBlock(blockNumber: number, length: number): Promise<Uint8Array> {
    const data = await this.controlIn(
      this.classSetup(DfuRequest.Upload, blockNumber),
      length,
      `UPLOAD block ${blockNumber}`,
    );
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  private dfuSeCommand(command: DfuSeCommand, address: number): Uint8Array {
    const bytes = new Uint8Array(5);
    bytes[0] = command;
    bytes[1] = address & 0xff;
    bytes[2] = (address >>> 8) & 0xff;
    bytes[3] = (address >>> 16) & 0xff;
    bytes[4] = (address >>> 24) & 0xff;
    return bytes;
  }

  async setMemoryPointer(address: number): Promise<void> {
    if (!Number.isInteger(address) || address < 0 || address > MAX_ABS_ADDRESS) {
      throw new ValidationError(`Invalid memory address ${address}.`);
    }
    await this.recoverToIdle();
    await this.sendBlock(0, this.dfuSeCommand(DfuSeCommand.SetAddress, address));
    await this.awaitDownloadComplete(TIMEOUTS.downloadStatus, `SET_ADDRESS ${formatAddress(address)}`);
    await this.abortToIdle();
  }

  async eraseSector(address: number, geometry?: FlashGeometry): Promise<void> {
    if (geometry) assertPageAligned(address, geometry);
    await this.recoverToIdle();
    await this.sendBlock(0, this.dfuSeCommand(DfuSeCommand.EraseSector, address));
    await this.awaitDownloadComplete(TIMEOUTS.eraseSector, `ERASE ${formatAddress(address)}`);
    await this.abortToIdle();
  }

  /**
   * Program an arbitrary address. Debug-only: the caller is responsible for
   * only targeting the application region. Not used by the normal UI.
   */
  async writeRaw(address: number, data: Uint8Array): Promise<void> {
    if (!Number.isInteger(address) || address < 0 || address > MAX_ABS_ADDRESS) {
      throw new ValidationError(`Invalid memory address ${address}.`);
    }
    if (data.length === 0) {
      throw new ValidationError('Refusing to program an empty block.');
    }
    await this.setMemoryPointer(address);
    await this.sendBlock(2, data);
    await this.awaitDownloadComplete(TIMEOUTS.downloadStatus, `WRITE ${formatAddress(address)}`);
    await this.abortToIdle();
  }

  async writeImage(
    image: FirmwareImage,
    geometry: FlashGeometry,
    options: WriteImageOptions = {},
  ): Promise<void> {
    assertFirmwareFits(image, geometry);
    throwIfAborted(options.signal);

    const eraseFirst = options.eraseFirst ?? true;
    const total = image.totalBytes;
    let written = 0;
    let lastAddress = image.startAddress;
    let modifiedFlash = false;

    try {
      if (eraseFirst) {
        const pageSet = new Set<number>();
        for (const segment of image.segments) {
          for (const page of pagesForRange(segment.address, segment.data.length, geometry)) {
            pageSet.add(page);
          }
        }
        const pages = [...pageSet].sort((a, b) => a - b);
        for (let index = 0; index < pages.length; index++) {
          throwIfAborted(options.signal);
          await this.eraseSector(pages[index], geometry);
          modifiedFlash = true;
          options.onProgress?.({
            phase: 'erase',
            percent: Math.floor(((index + 1) / pages.length) * 20),
            bytesDone: index + 1,
            bytesTotal: pages.length,
            address: pages[index],
          });
        }
      }

      for (const segment of image.segments) {
        for (let offset = 0; offset < segment.data.length; offset += this.transferBlockSize) {
          throwIfAborted(options.signal);
          const chunk = segment.data.subarray(
            offset,
            Math.min(offset + this.transferBlockSize, segment.data.length),
          );
          const address = segment.address + offset;

          await this.setMemoryPointer(address);
          await this.sendBlock(2, chunk);
          await this.awaitDownloadComplete(TIMEOUTS.downloadStatus, `WRITE ${formatAddress(address)}`);
          await this.abortToIdle();

          modifiedFlash = true;
          lastAddress = address;
          written += chunk.length;
          const percent = eraseFirst
            ? 20 + Math.floor((written / total) * 80)
            : Math.floor((written / total) * 100);
          options.onProgress?.({
            phase: 'write',
            percent: Math.min(percent, 100),
            bytesDone: written,
            bytesTotal: total,
            address,
          });
        }
      }

      await this.recoverToIdle();
    } catch (error) {
      if (modifiedFlash) {
        throw new PartialWriteError(
          `Writing was interrupted after flash was modified. Last block: ${formatAddress(lastAddress)}.`,
          lastAddress,
          written,
          { cause: error },
        );
      }
      throw error;
    }
  }

  async readFlash(
    startAddress: number,
    length: number,
    geometry: FlashGeometry,
    options: { onProgress?: (update: ProgressUpdate) => void; signal?: AbortSignal } = {},
  ): Promise<Uint8Array> {
    assertFlashRange(startAddress, length, geometry);
    throwIfAborted(options.signal);

    const result = new Uint8Array(length);
    let read = 0;
    while (read < length) {
      throwIfAborted(options.signal);
      const chunkLength = Math.min(this.transferBlockSize, length - read);
      const address = startAddress + read;

      await this.setMemoryPointer(address);
      const chunk = await this.receiveBlock(2, chunkLength);
      await this.abortToIdle();

      if (chunk.length === 0) {
        throw new TransportError('UPLOAD returned no data for the requested block.');
      }
      if (chunk.length < chunkLength) {
        throw new TransportError(
          `UPLOAD returned ${chunk.length} byte(s); expected ${chunkLength}.`,
        );
      }
      result.set(chunk.subarray(0, chunkLength), read);
      read += chunkLength;
      options.onProgress?.({
        phase: 'read',
        percent: Math.floor((read / length) * 100),
        bytesDone: read,
        bytesTotal: length,
        address,
      });
    }

    await this.recoverToIdle();
    return result;
  }

  async verifyImage(
    image: FirmwareImage,
    geometry: FlashGeometry,
    options: { onProgress?: (update: ProgressUpdate) => void; signal?: AbortSignal } = {},
  ): Promise<void> {
    assertFirmwareFits(image, geometry);
    throwIfAborted(options.signal);

    const total = image.totalBytes;
    let verified = 0;
    for (const segment of image.segments) {
      for (let offset = 0; offset < segment.data.length; offset += this.transferBlockSize) {
        throwIfAborted(options.signal);
        const length = Math.min(this.transferBlockSize, segment.data.length - offset);
        const address = segment.address + offset;

        await this.setMemoryPointer(address);
        const chunk = await this.receiveBlock(2, length);
        await this.abortToIdle();

        if (chunk.length < length) {
          throw new VerificationError(
            `Read-back at ${formatAddress(address)} returned ${chunk.length} byte(s); expected ${length}.`,
          );
        }
        for (let index = 0; index < length; index++) {
          const expected = segment.data[offset + index];
          if (chunk[index] !== expected) {
            throw new VerificationError(
              `Verification failed at ${formatAddress(address + index)}: ` +
                `expected 0x${expected.toString(16).padStart(2, '0')}, ` +
                `read 0x${chunk[index].toString(16).padStart(2, '0')}.`,
            );
          }
        }

        verified += length;
        options.onProgress?.({
          phase: 'verify',
          percent: Math.floor((verified / total) * 100),
          bytesDone: verified,
          bytesTotal: total,
          address,
        });
      }
    }

    await this.recoverToIdle();
  }

  async loadOptionBytes(
    geometry: FlashGeometry,
    signal?: AbortSignal,
  ): Promise<F350OptionBytes> {
    throwIfAborted(signal);
    await this.setMemoryPointer(geometry.optionByteBase);
    const raw = await this.receiveBlock(2, OPTION_BYTE_LENGTH);
    await this.abortToIdle();
    await this.recoverToIdle();
    return decodeOptionBytes(raw);
  }

  async rebootToApplication(entryAddress: number, geometry?: FlashGeometry): Promise<void> {
    if (geometry) assertAppRange(entryAddress, 1, geometry);
    try {
      await this.setMemoryPointer(entryAddress);
      // A zero-length DNLOAD triggers the DFU manifest and device reset.
      await this.sendBlock(0, new Uint8Array(0));
      await this.readStatus().catch(() => undefined);
    } catch {
      // The device resets during this sequence, so a failure here is expected.
    } finally {
      await this.close();
    }
  }
}
