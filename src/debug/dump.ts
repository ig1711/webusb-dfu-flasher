/**
 * Read-only USB descriptor inspection for the Debug page.
 *
 * Nothing here writes to the device: it only issues standard GET_DESCRIPTOR
 * control transfers (device, configuration and string 0..6) and formats the
 * result so the real hardware can be compared against the flash dump. This
 * collects the evidence for flasher-issues bugs 1 and 5.
 */

import { decodeStringBytes, readUsbStringRaw } from '../dfu/descriptors';
import type { UsbDeviceLike } from '../dfu/usb';

const GET_DESCRIPTOR = 0x06;
const DESC_DEVICE = 0x01;
const DESC_CONFIGURATION = 0x02;
const DESC_INTERFACE = 0x04;
const DESC_DFU_FUNCTIONAL = 0x21;

/** String descriptor indices dumped by default (0 = LANGID list). */
export const DEFAULT_STRING_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

export interface DeviceDescriptorInfo {
  rawHex: string;
  bcdUsb: string;
  classCode: number;
  subClass: number;
  protocol: number;
  maxPacket0: number;
  vendorId: number;
  productId: number;
  bcdDevice: string;
  iManufacturer: number;
  iProduct: number;
  iSerialNumber: number;
  numConfigurations: number;
}

export interface InterfaceInfo {
  number: number;
  alternate: number;
  endpoints: number;
  classCode: number;
  subClass: number;
  protocol: number;
  iInterface: number;
}

export interface DfuFunctionalInfo {
  bmAttributes: number;
  detachTimeout: number;
  transferSize: number;
  dfuVersion: string;
}

export interface ConfigurationInfo {
  totalLength: number;
  rawHex: string;
  interfaces: InterfaceInfo[];
  functional: DfuFunctionalInfo | null;
}

export interface StringInfo {
  index: number;
  kind: 'value' | 'absent' | 'unknown';
  rawHex: string;
  decoded: string;
}

export interface DescriptorDump {
  vendorId: number;
  productId: number;
  serialNumber: string | null;
  device: DeviceDescriptorInfo | null;
  configuration: ConfigurationInfo | null;
  strings: StringInfo[];
}

function toBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function bcd(value: number): string {
  return `${(value >> 8).toString(16)}.${(value & 0xff).toString(16).padStart(2, '0')}`;
}

async function readDescriptor(
  device: UsbDeviceLike,
  type: number,
  index: number,
  length: number,
): Promise<Uint8Array | null> {
  try {
    const result = await device.controlTransferIn(
      {
        requestType: 'standard',
        recipient: 'device',
        request: GET_DESCRIPTOR,
        value: ((type & 0xff) << 8) | (index & 0xff),
        index: 0,
      },
      length,
    );
    if (result.status !== 'ok' || !result.data) return null;
    return toBytes(result.data);
  } catch {
    return null;
  }
}

function parseDeviceDescriptor(bytes: Uint8Array): DeviceDescriptorInfo {
  return {
    rawHex: hex(bytes),
    bcdUsb: bcd(u16(bytes, 2)),
    classCode: bytes[4] ?? 0,
    subClass: bytes[5] ?? 0,
    protocol: bytes[6] ?? 0,
    maxPacket0: bytes[7] ?? 0,
    vendorId: u16(bytes, 8),
    productId: u16(bytes, 10),
    bcdDevice: bcd(u16(bytes, 12)),
    iManufacturer: bytes[14] ?? 0,
    iProduct: bytes[15] ?? 0,
    iSerialNumber: bytes[16] ?? 0,
    numConfigurations: bytes[17] ?? 0,
  };
}

function parseConfiguration(bytes: Uint8Array): ConfigurationInfo {
  const interfaces: InterfaceInfo[] = [];
  let functional: DfuFunctionalInfo | null = null;
  let offset = 0;

  while (offset + 2 <= bytes.length) {
    const length = bytes[offset];
    const type = bytes[offset + 1];
    if (length < 2) break;

    if (type === DESC_INTERFACE && offset + 9 <= bytes.length) {
      interfaces.push({
        number: bytes[offset + 2],
        alternate: bytes[offset + 3],
        endpoints: bytes[offset + 4],
        classCode: bytes[offset + 5],
        subClass: bytes[offset + 6],
        protocol: bytes[offset + 7],
        iInterface: bytes[offset + 8],
      });
    } else if (type === DESC_DFU_FUNCTIONAL && offset + 9 <= bytes.length) {
      functional = {
        bmAttributes: bytes[offset + 2],
        detachTimeout: u16(bytes, offset + 3),
        transferSize: u16(bytes, offset + 5),
        dfuVersion: bcd(u16(bytes, offset + 7)),
      };
    }

    offset += length;
  }

  return {
    totalLength: u16(bytes, 2),
    rawHex: hex(bytes),
    interfaces,
    functional,
  };
}

async function readStrings(
  device: UsbDeviceLike,
  indices: readonly number[],
  timeoutMs: number,
): Promise<StringInfo[]> {
  const strings: StringInfo[] = [];
  for (const index of indices) {
    const raw = await readUsbStringRaw(device, index, timeoutMs);
    if (raw.kind === 'value') {
      strings.push({ index, kind: 'value', rawHex: hex(raw.bytes), decoded: decodeStringBytes(raw.bytes) });
    } else {
      strings.push({ index, kind: raw.kind, rawHex: '', decoded: '' });
    }
  }
  return strings;
}

export interface DumpOptions {
  stringIndices?: readonly number[];
  stringTimeoutMs?: number;
}

/** Capture the full descriptor set (read-only). */
export async function dumpDescriptors(
  device: UsbDeviceLike,
  options: DumpOptions = {},
): Promise<DescriptorDump> {
  const indices = options.stringIndices ?? DEFAULT_STRING_INDICES;
  const stringTimeoutMs = options.stringTimeoutMs ?? 1_000;

  const deviceBytes = await readDescriptor(device, DESC_DEVICE, 0, 18);

  let configuration: ConfigurationInfo | null = null;
  const configHead = await readDescriptor(device, DESC_CONFIGURATION, 0, 9);
  if (configHead && configHead.length >= 4) {
    const total = u16(configHead, 2);
    const full = await readDescriptor(device, DESC_CONFIGURATION, 0, Math.max(total, 9));
    if (full) configuration = parseConfiguration(full);
  }

  const strings = await readStrings(device, indices, stringTimeoutMs);

  return {
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber ?? null,
    device: deviceBytes ? parseDeviceDescriptor(deviceBytes) : null,
    configuration,
    strings,
  };
}

function pad(label: string): string {
  return label.padEnd(18, ' ');
}

/** Human/agent-readable report; copied verbatim by the Debug page. */
export function formatDescriptorDump(dump: DescriptorDump): string {
  const lines: string[] = [];
  lines.push('USB descriptor dump (read-only)');
  lines.push(`VID:PID       ${dump.vendorId.toString(16).padStart(4, '0')}:${dump.productId.toString(16).padStart(4, '0')}`);
  lines.push(`serialNumber  ${dump.serialNumber ?? '(none)'}`);

  lines.push('');
  lines.push('Device descriptor');
  if (!dump.device) {
    lines.push('  (request failed or stalled)');
  } else {
    const d = dump.device;
    lines.push(`  raw                ${d.rawHex}`);
    lines.push(`  bcdUSB             ${d.bcdUsb}`);
    lines.push(`  bDeviceClass       0x${d.classCode.toString(16).padStart(2, '0')}`);
    lines.push(`  bDeviceSubClass    0x${d.subClass.toString(16).padStart(2, '0')}`);
    lines.push(`  bDeviceProtocol    0x${d.protocol.toString(16).padStart(2, '0')}`);
    lines.push(`  bMaxPacketSize0    ${d.maxPacket0}`);
    lines.push(`  idVendor           0x${d.vendorId.toString(16).padStart(4, '0')}`);
    lines.push(`  idProduct          0x${d.productId.toString(16).padStart(4, '0')}`);
    lines.push(`  bcdDevice          ${d.bcdDevice}`);
    lines.push(`  iManufacturer      ${d.iManufacturer}`);
    lines.push(`  iProduct           ${d.iProduct}`);
    lines.push(`  iSerialNumber      ${d.iSerialNumber}   <- serial string index`);
    lines.push(`  bNumConfigurations ${d.numConfigurations}`);
  }

  lines.push('');
  lines.push('Configuration descriptor');
  if (!dump.configuration) {
    lines.push('  (request failed or stalled)');
  } else {
    const c = dump.configuration;
    lines.push(`  wTotalLength       ${c.totalLength}`);
    lines.push(`  raw                ${c.rawHex}`);
    if (c.interfaces.length === 0) {
      lines.push('  interfaces         (none)');
    }
    for (const i of c.interfaces) {
      lines.push(
        `  interface ${i.number}.${i.alternate}      class 0x${i.classCode.toString(16).padStart(2, '0')} ` +
          `sub 0x${i.subClass.toString(16).padStart(2, '0')} proto 0x${i.protocol.toString(16).padStart(2, '0')} ` +
          `endpoints ${i.endpoints} iInterface ${i.iInterface}`,
      );
    }
    if (c.functional) {
      lines.push(
        `  DFU functional     bmAttributes 0x${c.functional.bmAttributes.toString(16).padStart(2, '0')} ` +
          `detachTimeout ${c.functional.detachTimeout} transferSize ${c.functional.transferSize} ` +
          `bcdDFU ${c.functional.dfuVersion}`,
      );
    } else {
      lines.push('  DFU functional     (not found in config descriptor)');
    }
  }

  lines.push('');
  lines.push('String descriptors');
  for (const s of dump.strings) {
    if (s.kind === 'value') {
      lines.push(`  [${s.index}] ${pad('value')} "${s.decoded}"`);
      lines.push(`      ${pad('raw')} ${s.rawHex}`);
    } else {
      lines.push(`  [${s.index}] ${s.kind}`);
    }
  }

  lines.push('');
  lines.push('Interpretation');
  const s3 = dump.strings.find((entry) => entry.index === 3);
  const s5 = dump.strings.find((entry) => entry.index === 5);
  lines.push(
    `  MCU ID source   serialNumber "${dump.serialNumber ?? ''}" (primary), ` +
      `string 3 ${s3?.kind === 'value' ? `"${s3.decoded}"` : s3?.kind ?? '(absent)'} (fallback)`,
  );
  lines.push(
    `  string 5        ${
      s5?.kind === 'value'
        ? s5.decoded.startsWith('@')
          ? 'starts with "@" -> DfuSe target name, NOT a lock flag'
          : `does not start with "@" ("${s5.decoded}")`
        : s5?.kind ?? '(absent)'
    }`,
  );
  return lines.join('\n');
}
