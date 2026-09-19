/**
 * Pure validation helpers. These never touch the device; they exist so that
 * every destructive operation can be proven safe before any USB I/O happens.
 */

import { APP_BASE, DEFAULT_FLASH_BASE, DEFAULT_OPTION_BYTE_BASE, OPTION_BYTE_LENGTH } from './codes';
import { ValidationError } from './errors';

export interface FlashGeometry {
  /** Lowest addressable flash byte (usually 0x08000000). */
  flashBase: number;
  /** Total usable flash size in bytes. */
  flashBytes: number;
  /** Erase granularity in bytes. */
  pageSize: number;
  /** Address of the option-byte page (never a valid firmware target). */
  optionByteBase: number;
  /** Size of the option-byte region in bytes. */
  optionByteBytes: number;
}

export const DEFAULT_GEOMETRY: FlashGeometry = {
  flashBase: DEFAULT_FLASH_BASE,
  flashBytes: 128 * 1024,
  pageSize: 1024,
  optionByteBase: DEFAULT_OPTION_BYTE_BASE,
  optionByteBytes: OPTION_BYTE_LENGTH,
};

function isSafeInteger(value: number): boolean {
  return Number.isInteger(value) && Number.isSafeInteger(value);
}

export function formatAddress(address: number): string {
  return `0x${(address >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

/** End of the usable flash region (exclusive). */
export function flashEnd(geometry: FlashGeometry): number {
  return geometry.flashBase + geometry.flashBytes;
}

export function optionByteEnd(geometry: FlashGeometry): number {
  return geometry.optionByteBase + geometry.optionByteBytes;
}

/** True when `[start, start + length)` intersects the option-byte region. */
export function overlapsOptionBytes(start: number, length: number, geometry: FlashGeometry): boolean {
  const end = start + length;
  return start < optionByteEnd(geometry) && end > geometry.optionByteBase;
}

export function assertValidGeometry(geometry: FlashGeometry): void {
  const { flashBase, flashBytes, pageSize, optionByteBase, optionByteBytes } = geometry;
  if (!isSafeInteger(flashBase) || flashBase < 0) {
    throw new ValidationError('Chip geometry has an invalid flash base address.');
  }
  if (!isSafeInteger(flashBytes) || flashBytes <= 0) {
    throw new ValidationError('Chip geometry has an invalid flash size.');
  }
  if (!isSafeInteger(pageSize) || pageSize <= 0 || pageSize % 2 !== 0) {
    throw new ValidationError('Chip geometry has an invalid page size.');
  }
  if (!isSafeInteger(optionByteBase) || !isSafeInteger(optionByteBytes) || optionByteBytes <= 0) {
    throw new ValidationError('Chip geometry has an invalid option-byte layout.');
  }
}

/**
 * Throws unless `[start, start + length)` lies entirely inside the flash
 * region and does not touch the option bytes. The option-byte page is never a
 * legal target for a normal burn/read.
 */
export function assertFlashRange(start: number, length: number, geometry: FlashGeometry): void {
  assertValidGeometry(geometry);

  if (!isSafeInteger(start) || start < 0) {
    throw new ValidationError('Start address must be a non-negative integer.');
  }
  if (!isSafeInteger(length) || length <= 0) {
    throw new ValidationError('Length must be a positive integer.');
  }
  if (start < geometry.flashBase) {
    throw new ValidationError(
      `Address ${formatAddress(start)} is below the flash base ${formatAddress(geometry.flashBase)}.`,
    );
  }
  if (start >= flashEnd(geometry)) {
    throw new ValidationError(
      `Address ${formatAddress(start)} is outside the flash region (ends at ${formatAddress(flashEnd(geometry))}).`,
    );
  }
  if (start + length > flashEnd(geometry)) {
    throw new ValidationError(
      `Range ${formatAddress(start)}–${formatAddress(start + length - 1)} exceeds the flash end at ${formatAddress(flashEnd(geometry))}.`,
    );
  }
  if (overlapsOptionBytes(start, length, geometry)) {
    throw new ValidationError(
      `Range ${formatAddress(start)}–${formatAddress(start + length - 1)} overlaps the option-byte region at ${formatAddress(geometry.optionByteBase)}.`,
    );
  }
}

/** Throws unless `address` is aligned to the erase page size. */
export function assertPageAligned(address: number, geometry: FlashGeometry): void {
  if (address % geometry.pageSize !== 0) {
    throw new ValidationError(
      `Address ${formatAddress(address)} is not aligned to the ${geometry.pageSize}-byte page size.`,
    );
  }
}

/**
 * Throws unless the range lies inside the application region, above the 16 KB
 * flash bootloader. The flash bootloader is never a valid application target.
 */
export function assertAppRange(start: number, length: number, geometry: FlashGeometry): void {
  assertFlashRange(start, length, geometry);
  if (start < APP_BASE) {
    throw new ValidationError(
      `Address ${formatAddress(start)} is inside the protected flash bootloader region ` +
        `(${formatAddress(geometry.flashBase)}-${formatAddress(APP_BASE - 1)}). ` +
        'Upload only the application/update binary.',
    );
  }
}

export interface ImageRangeOptions {
  /** Allow writing the flash bootloader region (full-chip restore only). */
  allowFlashBootloader?: boolean;
}

/** Range guard for a firmware image, honouring the application-only default. */
export function assertImageRange(
  start: number,
  length: number,
  geometry: FlashGeometry,
  options: ImageRangeOptions = {},
): void {
  if (options.allowFlashBootloader) {
    assertFlashRange(start, length, geometry);
  } else {
    assertAppRange(start, length, geometry);
  }
}

/**
 * Addresses of every page touched by `[start, start + length)`, aligned down
 * to page boundaries.
 */
export function pagesForRange(
  start: number,
  length: number,
  geometry: FlashGeometry,
  options: ImageRangeOptions = {},
): number[] {
  assertFlashRange(start, length, geometry);
  const first = Math.floor(start / geometry.pageSize) * geometry.pageSize;
  const last = start + length - 1;
  const pages: number[] = [];
  for (let address = first; address <= last; address += geometry.pageSize) {
    if (!options.allowFlashBootloader && address < APP_BASE) {
      throw new ValidationError(
        `Refusing to erase page ${formatAddress(address)}: it is inside the protected flash bootloader region.`,
      );
    }
    if (overlapsOptionBytes(address, geometry.pageSize, geometry)) {
      throw new ValidationError(
        `Refusing to erase page ${formatAddress(address)}: it overlaps the option-byte region.`,
      );
    }
    pages.push(address);
  }
  return pages;
}
