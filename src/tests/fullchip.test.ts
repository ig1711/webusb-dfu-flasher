import { describe, expect, it } from 'vitest';
import { FLASH_BOOTLOADER_BASE, FLASH_BOOTLOADER_SIZE, SRAM_BASE } from '../dfu/codes';
import { ValidationError } from '../dfu/errors';
import { DfuSession } from '../dfu/session';
import type { FlashGeometry } from '../dfu/validate';
import { createFirmwareImage, createFullChipImage, assertFirmwareFits } from '../firmware/image';
import { MockDfuDevice } from '../mocks/webusb';

const geometry: FlashGeometry = {
  flashBase: FLASH_BOOTLOADER_BASE,
  flashBytes: 64 * 1024,
  pageSize: 1024,
  optionByteBase: 0x1fff_f800,
  optionByteBytes: 16,
};
const sram = { start: SRAM_BASE, end: SRAM_BASE + 16 * 1024 };

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

function fullChipFile(): Uint8Array {
  const bytes = new Uint8Array(geometry.flashBytes).fill(0xff);
  writeVectorTable(bytes, 0, 0x0800_0165);
  writeVectorTable(bytes, FLASH_BOOTLOADER_SIZE, 0x0800_4165);
  return bytes;
}

describe('createFullChipImage', () => {
  it('accepts a complete flash image with the known layout', () => {
    const image = createFullChipImage(fullChipFile(), geometry, sram);
    expect(image.kind).toBe('fullchip');
    expect(image.startAddress).toBe(FLASH_BOOTLOADER_BASE);
    expect(() => assertFirmwareFits(image, geometry)).not.toThrow();
  });

  it('rejects a file that is not exactly one flash', () => {
    expect(() => createFullChipImage(new Uint8Array(1024), geometry, sram)).toThrow(/exactly/i);
  });

  it('rejects a file without the application vector table', () => {
    const bytes = new Uint8Array(geometry.flashBytes).fill(0xff);
    writeVectorTable(bytes, 0, 0x0800_0165);
    expect(() => createFullChipImage(bytes, geometry, sram)).toThrow(ValidationError);
  });

  it('keeps application images restricted to the application region', () => {
    const app = createFirmwareImage(new Uint8Array(16));
    expect(app.startAddress).toBe(0x0800_4000);
  });
});

describe('full-chip write', () => {
  it('erases and writes from 0x08000000', async () => {
    const device = new MockDfuDevice({ flashSize: geometry.flashBytes });
    const session = new DfuSession({ requestDevice: async () => device, transferBlockSize: 1024 });
    await session.open();

    const image = createFullChipImage(fullChipFile(), geometry, sram);
    await session.writeImage(image, geometry, { eraseFirst: true });

    expect(device.eraseOps).toContain(FLASH_BOOTLOADER_BASE);
    const boot = device.read(FLASH_BOOTLOADER_BASE, 8);
    expect(boot[4]).toBe(0x65);
    expect(boot[5]).toBe(0x01);
  });
});
