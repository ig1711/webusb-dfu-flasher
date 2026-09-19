import { describe, expect, it } from 'vitest';
import { APP_BASE, FLASH_BOOTLOADER_BASE, FLASH_BOOTLOADER_SIZE, SRAM_BASE } from '../dfu/codes';
import { ValidationError } from '../dfu/errors';
import type { FlashGeometry } from '../dfu/validate';
import { assertKnownLayout, findVectorTables } from '../chip/layout';

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
  for (let word = 2; word < 16; word++) {
    writeU32(buffer, offset + word * 4, 0x0800_0101 + word * 4);
  }
}

function window(): Uint8Array {
  return new Uint8Array(FLASH_BOOTLOADER_SIZE + 64);
}

describe('findVectorTables', () => {
  it('finds tables at the bootloader and application bases', () => {
    const data = window();
    writeVectorTable(data, 0, 0x0800_0165);
    writeVectorTable(data, FLASH_BOOTLOADER_SIZE, 0x0800_4165);
    const tables = findVectorTables(data, FLASH_BOOTLOADER_BASE, geometry, sram);
    expect(tables.map((table) => table.address)).toEqual([FLASH_BOOTLOADER_BASE, APP_BASE]);
  });

  it('ignores a table whose stack pointer is outside SRAM', () => {
    const data = window();
    writeVectorTable(data, 0, 0x0800_0165);
    writeU32(data, 0, 0x3000_0000);
    expect(findVectorTables(data, FLASH_BOOTLOADER_BASE, geometry, sram)).toHaveLength(0);
  });
});

describe('assertKnownLayout', () => {
  it('accepts the known 16 KB bootloader layout', () => {
    const data = window();
    writeVectorTable(data, 0, 0x0800_0165);
    writeVectorTable(data, FLASH_BOOTLOADER_SIZE, 0x0800_4165);
    const layout = assertKnownLayout(data, FLASH_BOOTLOADER_BASE, geometry, sram);
    expect(layout.appBase).toBe(APP_BASE);
    expect(layout.flashBootloaderBytes).toBe(FLASH_BOOTLOADER_SIZE);
  });

  it('rejects a missing application table', () => {
    const data = window();
    writeVectorTable(data, 0, 0x0800_0165);
    expect(() => assertKnownLayout(data, FLASH_BOOTLOADER_BASE, geometry, sram)).toThrow(ValidationError);
  });

  it('rejects a missing bootloader table', () => {
    const data = window();
    writeVectorTable(data, FLASH_BOOTLOADER_SIZE, 0x0800_4165);
    expect(() => assertKnownLayout(data, FLASH_BOOTLOADER_BASE, geometry, sram)).toThrow(/bootloader was not found/i);
  });

  it('rejects an unexpected table inside the bootloader region', () => {
    const data = window();
    writeVectorTable(data, 0, 0x0800_0165);
    writeVectorTable(data, 0x2000, 0x0800_2165);
    writeVectorTable(data, FLASH_BOOTLOADER_SIZE, 0x0800_4165);
    expect(() => assertKnownLayout(data, FLASH_BOOTLOADER_BASE, geometry, sram)).toThrow(/Unexpected vector table/i);
  });
});
