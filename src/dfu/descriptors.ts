/**
 * Reads the bootloader's USB string descriptors to identify the chip.
 *
 * Some GD32 bootloaders return an ASCII (non-conformant) serial descriptor that
 * WebUSB mis-decodes as UTF-16; we therefore prefer the raw string-3
 * descriptor and only fall back to recovering ASCII bytes from the browser's
 * serial number. Protection is read separately from the option bytes.
 */

import { STRING_INDEX, TIMEOUTS } from './codes';
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
}

/** Decode a raw UTF-16 or ASCII string descriptor body (including the header). */
export function decodeStringBytes(bytes: Uint8Array): string {
  const length = Math.min(bytes[0] ?? 0, bytes.length);
  if (length < 2) return '';

  const body = bytes.subarray(2, length);
  const looksUtf16 = body.length >= 2 && body.every((byte, index) => index % 2 === 0 || byte === 0);
  let value = '';
  if (looksUtf16) {
    for (let index = 0; index + 1 < body.length; index += 2) {
      value += String.fromCharCode(body[index] | (body[index + 1] << 8));
    }
  } else {
    for (const byte of body) {
      if (byte >= 32 && byte <= 126) value += String.fromCharCode(byte);
    }
  }
  return value.trim();
}

/** Raw bytes returned by a successful string-descriptor request. */
export type RawStringReadResult =
  | { kind: 'value'; bytes: Uint8Array }
  | { kind: 'absent' }
  | { kind: 'unknown' };

/** Read a string descriptor without decoding it, for diagnostics. */
export async function readUsbStringRaw(
  device: UsbDeviceLike,
  index: number,
  timeoutMs: number = TIMEOUTS.stringDescriptor,
): Promise<RawStringReadResult> {
  if (!index) return { kind: 'absent' };

  const transfer = (async (): Promise<RawStringReadResult> => {
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
      const { buffer, byteOffset, byteLength } = result.data;
      return { kind: 'value', bytes: new Uint8Array(buffer, byteOffset, byteLength) };
    } catch {
      return { kind: 'unknown' };
    }
  })();

  const timeout = new Promise<RawStringReadResult>((resolve) => {
    setTimeout(() => resolve({ kind: 'unknown' }), timeoutMs);
  });

  return Promise.race([transfer, timeout]);
}

export async function readUsbString(
  device: UsbDeviceLike,
  index: number,
  timeoutMs: number = TIMEOUTS.stringDescriptor,
): Promise<StringReadResult> {
  const raw = await readUsbStringRaw(device, index, timeoutMs);
  if (raw.kind !== 'value') return raw;
  return { kind: 'value', value: decodeStringBytes(raw.bytes) };
}

/**
 * Recover ASCII text from a descriptor that WebUSB decoded as UTF-16. A device
 * that returns an ASCII serial descriptor yields 16-bit code units whose two
 * bytes are the original characters (e.g. "刵䜸" -> "5R8G").
 */
function recoverAsciiFromUtf16Misdecode(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    for (const byte of [code & 0xff, (code >> 8) & 0xff]) {
      if (byte >= 0x20 && byte <= 0x7e) result += String.fromCharCode(byte);
    }
  }
  return result;
}

async function readMcuid(device: UsbDeviceLike, timeoutMs: number): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const read = await readUsbString(device, STRING_INDEX.mcuId, timeoutMs);
    if (read.kind === 'value' && read.value.length >= 4) {
      return read.value.slice(0, 4).toUpperCase();
    }
    if (read.kind === 'absent') break;
  }
  return '';
}

export async function identifyChip(
  device: UsbDeviceLike,
  timeoutMs: number = TIMEOUTS.stringDescriptor,
): Promise<ChipIdentity> {
  let mcuid = await readMcuid(device, timeoutMs);
  if (!mcuid) {
    const serial = device.serialNumber?.trim();
    if (serial) {
      const recovered = recoverAsciiFromUtf16Misdecode(serial);
      if (recovered.length >= 4) mcuid = recovered.slice(0, 4).toUpperCase();
    }
  }

  const part = findF350Part(mcuid);
  return { identified: part !== null, mcuid, part };
}
