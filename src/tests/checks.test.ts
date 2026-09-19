import { describe, expect, it } from 'vitest';
import { APP_BASE, FLASH_BOOTLOADER_SIZE, SRAM_BASE } from '../dfu/codes';
import { encodeOptionBytes } from '../dfu/optionBytes';
import { DfuSession } from '../dfu/session';
import { DeviceCheckError, runDeviceChecks, type CheckOutcome } from '../flasher/checks';
import { MockDfuDevice } from '../mocks/webusb';

function writeU32(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function writeVectorTable(buffer: Uint8Array, offset: number, reset: number): void {
  writeU32(buffer, offset, SRAM_BASE + 0x1000);
  writeU32(buffer, offset + 4, reset);
  for (let word = 2; word < 16; word++) writeU32(buffer, offset + word * 4, 0x0800_0101 + word * 4);
}

function makeDevice(): MockDfuDevice {
  const device = new MockDfuDevice({ flashSize: 64 * 1024, serialNumber: '5R8G0000', strings: { 5: '@GD32' } });
  device.optionBytes.set(
    encodeOptionBytes({ spc: 0xa5, user: 0xff, data0: 0xff, data1: 0xff, wp0: 0xff, wp1: 0xff }),
  );
  const layout = new Uint8Array(FLASH_BOOTLOADER_SIZE + 64);
  writeVectorTable(layout, 0, 0x0800_0165);
  writeVectorTable(layout, FLASH_BOOTLOADER_SIZE, 0x0800_4165);
  device.flash.set(layout, 0);
  return device;
}

function createSession(device: MockDfuDevice): DfuSession {
  return new DfuSession({ requestDevice: async () => device, transferBlockSize: 256 });
}

describe('runDeviceChecks', () => {
  it('passes for a supported F350 tablet', async () => {
    const device = makeDevice();
    const session = createSession(device);
    await session.open();

    const outcomes: CheckOutcome[] = [];
    const verified = await runDeviceChecks(session, { onOutcome: (outcome) => outcomes.push(outcome) });

    expect(verified.part.partNumber).toBe('GD32F350R8T6');
    expect(verified.layout.appBase).toBe(APP_BASE);
    expect(verified.protection).toBe('none');
    expect(verified.romBootloaderAccess).toBe('accessible');
    expect(outcomes.every((outcome) => outcome.status === 'pass')).toBe(true);
  });

  it('fails fast on high protection without reading flash', async () => {
    const device = makeDevice();
    device.optionBytes.set(
      encodeOptionBytes({ spc: 0xcc, user: 0xff, data0: 0xff, data1: 0xff, wp0: 0xff, wp1: 0xff }),
    );
    const session = createSession(device);
    await session.open();

    const outcomes: CheckOutcome[] = [];
    await expect(
      runDeviceChecks(session, { onOutcome: (outcome) => outcomes.push(outcome) }),
    ).rejects.toBeInstanceOf(DeviceCheckError);
    expect(outcomes.at(-1)?.status).toBe('fail');
    expect(outcomes.some((outcome) => outcome.id === 'protection')).toBe(true);
    expect(outcomes.some((outcome) => outcome.id === 'flash-bootloader-layout')).toBe(false);
  });

  it('fails on an inconsistent SPC complement', async () => {
    const device = makeDevice();
    const raw = encodeOptionBytes({ spc: 0xbb, user: 0xff, data0: 0xff, data1: 0xff, wp0: 0xff, wp1: 0xff });
    raw[1] = 0x00;
    device.optionBytes.set(raw);
    const session = createSession(device);
    await session.open();
    await expect(runDeviceChecks(session)).rejects.toMatchObject({ checkId: 'protection' });
  });

  it('fails on a non-F350 chip', async () => {
    const device = makeDevice();
    device.serialNumber = 'ZZZZ0000';
    const session = createSession(device);
    await session.open();

    const outcomes: CheckOutcome[] = [];
    await expect(
      runDeviceChecks(session, { onOutcome: (outcome) => outcomes.push(outcome) }),
    ).rejects.toMatchObject({ checkId: 'identity' });
    expect(outcomes).toHaveLength(1);
  });

  it('fails on an unrecognized flash layout', async () => {
    const device = makeDevice();
    device.flash.fill(0xff);
    const session = createSession(device);
    await session.open();
    await expect(runDeviceChecks(session)).rejects.toMatchObject({ checkId: 'flash-bootloader-layout' });
  });
});
