import { describe, expect, it } from 'vitest';
import { dumpDescriptors, formatDescriptorDump } from '../debug/dump';
import { formatOptionBytes, probeBootloaderProtection } from '../debug/operations';
import { decodeOptionBytes } from '../dfu/optionBytes';
import { DfuSession } from '../dfu/session';
import type { FlashGeometry } from '../dfu/validate';
import { MockDfuDevice } from '../mocks/webusb';
import type { UsbControlSetup, UsbDeviceLike, UsbInTransferResult } from '../dfu/usb';

function stringDescriptor(value: string): Uint8Array {
  const bytes = new Uint8Array(2 + value.length * 2);
  bytes[0] = bytes.length;
  bytes[1] = 0x03;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    bytes[2 + index * 2] = code & 0xff;
    bytes[3 + index * 2] = code >> 8;
  }
  return bytes;
}

function deviceDescriptor(): Uint8Array {
  const bytes = new Uint8Array(18);
  bytes[0] = 18;
  bytes[1] = 0x01;
  bytes[2] = 0x00;
  bytes[3] = 0x02;
  bytes[8] = 0xe9;
  bytes[9] = 0x28;
  bytes[10] = 0x89;
  bytes[11] = 0x01;
  bytes[16] = 3;
  bytes[17] = 1;
  return bytes;
}

function configDescriptor(): Uint8Array {
  const bytes = new Uint8Array(9 + 9 + 9);
  bytes[0] = 9;
  bytes[1] = 0x02;
  bytes[2] = bytes.length;
  bytes[4] = 1;
  bytes[5] = 1;
  bytes[9] = 9;
  bytes[10] = 0x04;
  bytes[14] = 0xfe;
  bytes[15] = 0x01;
  bytes[16] = 0x02;
  const functional = 18;
  bytes[functional] = 9;
  bytes[functional + 1] = 0x21;
  bytes[functional + 5] = 0x00;
  bytes[functional + 6] = 0x04;
  return bytes;
}

function descriptorDevice(): UsbDeviceLike {
  const strings: Record<number, string> = {
    0: '\u0409',
    3: '5R8G',
    5: '@Internal Flash /0x08000000/16*001Ka,48*001Kg',
  };
  return {
    vendorId: 0x28e9,
    productId: 0x0189,
    serialNumber: '5R8G0000',
    opened: true,
    configuration: { configurationValue: 1 },
    open: async () => {},
    close: async () => {},
    selectConfiguration: async () => {},
    claimInterface: async () => {},
    releaseInterface: async () => {},
    controlTransferOut: async () => ({ status: 'ok' }),
    controlTransferIn: async (setup: UsbControlSetup): Promise<UsbInTransferResult> => {
      if (setup.request !== 0x06) return { status: 'stall' };
      const type = (setup.value >> 8) & 0xff;
      const index = setup.value & 0xff;
      if (type === 0x01) {
        const bytes = deviceDescriptor();
        return { status: 'ok', data: new DataView(bytes.buffer) };
      }
      if (type === 0x02) {
        const bytes = configDescriptor();
        return { status: 'ok', data: new DataView(bytes.buffer) };
      }
      if (type === 0x03) {
        const value = strings[index];
        if (value === undefined) return { status: 'stall' };
        const bytes = stringDescriptor(value);
        return { status: 'ok', data: new DataView(bytes.buffer) };
      }
      return { status: 'stall' };
    },
  };
}

describe('dumpDescriptors', () => {
  it('parses the device, configuration and string descriptors', async () => {
    const dump = await dumpDescriptors(descriptorDevice());
    expect(dump.device?.vendorId).toBe(0x28e9);
    expect(dump.device?.productId).toBe(0x0189);
    expect(dump.device?.iSerialNumber).toBe(3);
    expect(dump.configuration?.totalLength).toBe(27);
    expect(dump.configuration?.interfaces[0]?.classCode).toBe(0xfe);
    expect(dump.configuration?.functional?.transferSize).toBe(0x0400);

    const report = formatDescriptorDump(dump);
    expect(report).toContain('5R8G');
    expect(report).toContain('@Internal Flash');
    expect(report).toContain('DFU functional');
  });
});

describe('formatOptionBytes', () => {
  it('reports the low-protection value and both interpretations', () => {
    const raw = new Uint8Array(16).fill(0xff);
    raw[0] = 0xbb;
    raw[1] = 0x44;
    const report = formatOptionBytes(decodeOptionBytes(raw));
    expect(report).toContain('BB 44');
    expect(report).toContain('OB_SPC REG16  0x44BB');
    expect(report).toContain('low (any value except 0xA5/0xCC)');
    expect(report).toContain('unprogrammed (0xFF)');
  });
});

describe('probeBootloaderProtection', () => {
  const geometry: FlashGeometry = {
    flashBase: 0x0800_0000,
    flashBytes: 64 * 1024,
    pageSize: 1024,
    optionByteBase: 0x1fff_f800,
    optionByteBytes: 16,
  };

  it('detects a writable region and restores the page', async () => {
    const device = new MockDfuDevice({ flashSize: geometry.flashBytes });
    const session = new DfuSession({ requestDevice: async () => device, transferBlockSize: 256 });
    await session.open();

    const report = await probeBootloaderProtection(session, geometry, 0x0800_3800);
    expect(report.changed).toBe(true);
    expect(report.text).toContain('NOT protected');
    // The page must be erased back to 0xFF.
    expect([...device.read(0x0800_3800, 8)]).toEqual([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  });
});
