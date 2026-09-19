/**
 * Reads the ROM DFU bootloader's USB string descriptors to identify the chip
 * and to hint at whether it will serve flash.
 *
 * The string-5 heuristic is treated only as a hint: the authoritative
 * "ROM DFU bootloader access" signal is whether the verification read actually
 * succeeds. Protection is read separately from the option bytes.
 */

import { STRING_INDEX, TIMEOUTS, UNPROTECTED_MARKER } from './codes';
import { findF350Part } from '../chip/lookup';
import type { F350Part } from '../chip/f350';
import type { UsbDeviceLike } from './usb';

export type StringReadResult =
  | { kind: 'value'; value: string }
  | { kind: 'absent' }
  | { kind: 'unknown' };

export type RomBootloaderAccess = 'accessible' | 'blocked' | 'unknown';

export interface ChipIdentity {
  /** True only when the MCUID resolves to a supported GD32F350 part. */
  identified: boolean;
  mcuid: string;
  part: F350Part | null;
  /** Hint from string descriptor 5; superseded by observed reads. */
  romBootloaderAccess: RomBootloaderAccess;
}

interface StringDescriptorPayload {
  byteLength: number;
  getUint8(index: number): number;
}

function decodeStringDescriptor(view: StringDescriptorPayload): string {
  const length = Math.min(view.getUint8(0), view.byteLength);
  if (length < 2) return '';

  const bytes: number[] = [];
  for (let index = 2; index < length; index++) {
    bytes.push(view.getUint8(index));
  }

  const looksUtf16 = bytes.length >= 2 && bytes.every((byte, index) => index % 2 === 0 || byte === 0);
  let value = '';
  if (looksUtf16) {
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      value += String.fromCharCode(bytes[index] | (bytes[index + 1] << 8));
    }
  } else {
    for (const byte of bytes) {
      if (byte >= 32 && byte <= 126) value += String.fromCharCode(byte);
    }
  }
  return value.trim();
}

export async function readUsbString(
  device: UsbDeviceLike,
  index: number,
  timeoutMs: number = TIMEOUTS.stringDescriptor,
): Promise<StringReadResult> {
  if (!index) return { kind: 'absent' };

  const transfer = (async (): Promise<StringReadResult> => {
    try {
      const result = await device.controlTransferIn(
        {
          requestType: 'standard',
          recipient: 'device',
          request: 0x06,
          value: (0x03 << 8) | index,
          index: 0,
        },
        255,
      );

      if (result.status === 'stall') return { kind: 'absent' };
      if (result.status !== 'ok' || !result.data || result.data.byteLength < 2) {
        return { kind: 'absent' };
      }
      return { kind: 'value', value: decodeStringDescriptor(result.data) };
    } catch {
      return { kind: 'unknown' };
    }
  })();

  const timeout = new Promise<StringReadResult>((resolve) => {
    setTimeout(() => resolve({ kind: 'unknown' }), timeoutMs);
  });

  return Promise.race([transfer, timeout]);
}

export async function identifyChip(
  device: UsbDeviceLike,
  timeoutMs: number = TIMEOUTS.stringDescriptor,
): Promise<ChipIdentity> {
  let mcuid = '';
  const serial = device.serialNumber?.trim();
  if (serial && serial.length >= 4) {
    mcuid = serial.slice(0, 4).toUpperCase();
  }
  if (!mcuid) {
    const read = await readUsbString(device, STRING_INDEX.mcuId, timeoutMs);
    if (read.kind === 'value' && read.value.length >= 4) {
      mcuid = read.value.slice(0, 4).toUpperCase();
    }
  }

  const protection = await readUsbString(device, STRING_INDEX.protection, timeoutMs);
  let romBootloaderAccess: RomBootloaderAccess = 'unknown';
  if (protection.kind === 'value') {
    romBootloaderAccess = protection.value.startsWith(UNPROTECTED_MARKER) ? 'accessible' : 'blocked';
  }

  const part = findF350Part(mcuid);
  return { identified: part !== null, mcuid, part, romBootloaderAccess };
}
