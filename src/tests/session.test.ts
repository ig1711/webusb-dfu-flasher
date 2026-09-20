import { describe, expect, it } from 'vitest';
import { DfuSession } from '../dfu/session';
import { APP_BASE } from '../dfu/codes';
import {
  DfuStatusError,
  OperationAbortedError,
  PartialWriteError,
  StallError,
  ValidationError,
  VerificationError,
} from '../dfu/errors';
import { identifyChip } from '../dfu/descriptors';
import { DfuRequest, DfuStatusCode } from '../dfu/codes';
import { createFirmwareImage, type FirmwareImage } from '../firmware/image';
import type { FlashGeometry } from '../dfu/validate';
import { MockDfuDevice } from '../mocks/webusb';

const geometry: FlashGeometry = {
  flashBase: 0x0800_0000,
  flashBytes: 64 * 1024,
  pageSize: 1024,
  optionByteBase: 0x1fff_f800,
  optionByteBytes: 16,
};

function payload(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 7 + 3) & 0xff);
}

function createSession(device: MockDfuDevice): DfuSession {
  return new DfuSession({ requestDevice: async () => device, transferBlockSize: 256 });
}

function makeDevice(): MockDfuDevice {
  return new MockDfuDevice({ flashSize: 64 * 1024, serialNumber: '5R8G0000', strings: { 5: '@GD32' } });
}

describe('DfuSession.open', () => {
  it('rejects any device that is not 28e9:0189', async () => {
    const device = new MockDfuDevice({ productId: 0x1234 });
    await expect(createSession(device).open()).rejects.toBeInstanceOf(ValidationError);
  });

  it('opens, selects a configuration and claims the interface', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();
    expect(device.opened).toBe(true);
    expect(device.claimed).toBe(true);
    await session.close();
    expect(device.opened).toBe(false);
  });
});

describe('DfuSession.writeImage / readFlash', () => {
  it('writes at the application base and reads back identical data', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();

    const data = payload(600);
    await session.writeImage(createFirmwareImage(data), geometry, { eraseFirst: true });
    expect(device.eraseOps).toContain(APP_BASE);

    const readBack = await session.readFlash(APP_BASE, data.length, geometry);
    expect([...readBack]).toEqual([...data]);
  });

  it('refuses to write into the bootloader region', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();

    const rogue: FirmwareImage = {
      segments: [{ address: 0x0800_0000, data: payload(16) }],
      startAddress: 0x0800_0000,
      endAddressExclusive: 0x0800_0010,
      totalBytes: 16,
      sourceName: null,
    };
    await expect(session.writeImage(rogue, geometry, {})).rejects.toBeInstanceOf(ValidationError);
  });

  it('verifies successfully and detects corruption', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();

    const data = payload(300);
    const image = createFirmwareImage(data);
    await session.writeImage(image, geometry, { eraseFirst: false });
    await expect(session.verifyImage(image, geometry)).resolves.toBeUndefined();

    device.corrupt(APP_BASE + 0x10, data[0x10] ^ 0xff);
    await expect(session.verifyImage(image, geometry)).rejects.toBeInstanceOf(VerificationError);
  });

  it('surfaces a device-reported write error', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();

    device.failWriteAtNext(APP_BASE, DfuStatusCode.ErrWrite);
    await expect(
      session.writeImage(createFirmwareImage(payload(300)), geometry, { eraseFirst: false }),
    ).rejects.toBeInstanceOf(DfuStatusError);
  });

  it('refuses to start when already aborted', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();

    const controller = new AbortController();
    controller.abort();
    await expect(
      session.writeImage(createFirmwareImage(payload(300)), geometry, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(OperationAbortedError);
  });

  it('reports a partial write when cancelled mid-operation', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();

    const controller = new AbortController();
    await expect(
      session.writeImage(createFirmwareImage(payload(800)), geometry, {
        eraseFirst: false,
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toBeInstanceOf(PartialWriteError);
  });

  it('validates ranges before touching the device', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();
    await expect(session.readFlash(APP_BASE, geometry.flashBytes, geometry)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('propagates stalls', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();
    device.setStall(DfuRequest.Download);
    await expect(session.eraseSector(APP_BASE, geometry)).rejects.toBeInstanceOf(StallError);
  });
});

describe('identifyChip', () => {
  it('resolves an F350 part', async () => {
    const device = makeDevice();
    await device.open();
    const identity = await identifyChip(device);
    expect(identity.identified).toBe(true);
    expect(identity.part?.partNumber).toBe('GD32F350R8T6');
  });

  it('marks a non-F350 MCUID as unidentified', async () => {
    const device = new MockDfuDevice({ serialNumber: '3C8A0000' });
    await device.open();
    const identity = await identifyChip(device);
    expect(identity.identified).toBe(false);
    expect(identity.part).toBeNull();
  });

  it('reads the MCU ID from an ASCII string-3 descriptor', async () => {
    const device = new MockDfuDevice({ strings: { 3: '5R8G' } });
    await device.open();
    const identity = await identifyChip(device);
    expect(identity.mcuid).toBe('5R8G');
    expect(identity.part?.partNumber).toBe('GD32F350R8T6');
  });

  it('recovers the MCU ID from a UTF-16-misdecoded serial', async () => {
    // "5R8G" ASCII bytes decoded as UTF-16LE by WebUSB.
    const device = new MockDfuDevice({ serialNumber: '\u5235\u4738' });
    await device.open();
    const identity = await identifyChip(device);
    expect(identity.mcuid).toBe('5R8G');
    expect(identity.part?.partNumber).toBe('GD32F350R8T6');
  });
});
