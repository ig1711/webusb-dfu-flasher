/**
 * Fixed-layout fingerprint for supported tablets.
 *
 * The USB DFU device is the flash bootloader itself, user code stored in the
 * first 16 KB of main flash at 0x08000000 (it has no ROM-bootloader jump). The
 * application starts at 0x08004000.
 *
 * Supported devices have flash vector tables at 0x08000000 (flash bootloader)
 * and 0x08004000 (application), with none in between. Anything else is
 * rejected.
 */

import { APP_BASE, FLASH_BOOTLOADER_BASE, FLASH_BOOTLOADER_SIZE, SRAM_BASE } from './geometry';
import { ValidationError } from '../dfu/errors';
import { formatAddress, type FlashGeometry } from '../dfu/validate';

export interface VectorTable {
  address: number;
  sp: number;
  reset: number;
  /** Number of the first 16 words that are odd flash pointers (max 16). */
  score: number;
}

const MIN_TABLE_SCORE = 8;
const TABLE_WORDS = 16;

function readUint32(data: Uint8Array, offset: number): number {
  return (
    (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0
  );
}

function looksLikeVectorTable(
  data: Uint8Array,
  offset: number,
  baseAddress: number,
  geometry: FlashGeometry,
  sram: { start: number; end: number },
): VectorTable | null {
  if (offset + TABLE_WORDS * 4 > data.length) return null;

  const sp = readUint32(data, offset);
  const reset = readUint32(data, offset + 4);
  const flashEnd = geometry.flashBase + geometry.flashBytes;

  if (sp < sram.start || sp > sram.end || sp % 8 !== 0) return null;
  if ((reset & 1) === 0 || reset < geometry.flashBase || reset >= flashEnd) return null;

  let score = 0;
  for (let word = 0; word < TABLE_WORDS; word++) {
    const value = readUint32(data, offset + word * 4);
    if ((value & 1) !== 0 && value >= geometry.flashBase && value < flashEnd) score++;
  }
  if (score < MIN_TABLE_SCORE) return null;

  return { address: baseAddress + offset, sp, reset, score };
}

/**
 * Scan page-aligned offsets for plausible vector tables. `data` starts at
 * `baseAddress`.
 */
export function findVectorTables(
  data: Uint8Array,
  baseAddress: number,
  geometry: FlashGeometry,
  sram: { start: number; end: number },
): VectorTable[] {
  const tables: VectorTable[] = [];
  for (let offset = 0; offset + 8 <= data.length; offset += geometry.pageSize) {
    const table = looksLikeVectorTable(data, offset, baseAddress, geometry, sram);
    if (table) tables.push(table);
  }
  // Also allow a table at the very end of the window even if page stepping
  // missed it (no-op for our fixed 0x4040-byte read).
  return tables;
}

export interface LayoutFingerprint {
  flashBootloaderBase: number;
  appBase: number;
  flashBootloaderBytes: number;
  tables: VectorTable[];
}

/**
 * Verify the known 16 KB flash bootloader + application layout. Throws a
 * `ValidationError` describing the first mismatch.
 */
export function assertKnownLayout(
  window: Uint8Array,
  windowBase: number,
  geometry: FlashGeometry,
  sram: { start: number; end: number },
): LayoutFingerprint {
  const tables = findVectorTables(window, windowBase, geometry, sram);
  const appOffset = APP_BASE - windowBase;

  const hasBootTable = tables.some((table) => table.address === FLASH_BOOTLOADER_BASE);
  const appTable = tables.find((table) => table.address === APP_BASE);
  const unexpected = tables.filter(
    (table) => table.address > FLASH_BOOTLOADER_BASE && table.address < APP_BASE,
  );

  if (!hasBootTable) {
    throw new ValidationError(
      `No valid vector table at ${formatAddress(FLASH_BOOTLOADER_BASE)}; the 16 KB flash bootloader was not found.`,
    );
  }
  if (appOffset < 8) {
    throw new ValidationError('The verification window does not reach the application base.');
  }
  if (!appTable) {
    throw new ValidationError(
      `No valid application vector table at ${formatAddress(APP_BASE)}; refusing to modify this device.`,
    );
  }
  if (unexpected.length > 0) {
    throw new ValidationError(
      `Unexpected vector table at ${formatAddress(unexpected[0].address)} inside the flash bootloader region; ` +
        'this layout is not supported.',
    );
  }

  return {
    flashBootloaderBase: FLASH_BOOTLOADER_BASE,
    appBase: APP_BASE,
    flashBootloaderBytes: FLASH_BOOTLOADER_SIZE,
    tables,
  };
}

export { APP_BASE, FLASH_BOOTLOADER_BASE, FLASH_BOOTLOADER_SIZE, SRAM_BASE };
