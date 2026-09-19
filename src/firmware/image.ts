/**
 * Firmware images.
 *
 * Two kinds are supported:
 *  - `application`: a raw update binary programmed at APP_BASE (0x08004000);
 *  - `fullchip`: a complete flash image including the 16 KB flash bootloader,
 *    programmed at 0x08000000. Used only for explicit full-chip restore.
 */

import { APP_BASE, FLASH_BOOTLOADER_BASE } from '../dfu/codes';
import { ValidationError } from '../dfu/errors';
import { assertImageRange, formatAddress, type FlashGeometry } from '../dfu/validate';
import { assertKnownLayout } from '../chip/layout';

export type ImageKind = 'application' | 'fullchip';

export interface FirmwareSegment {
  readonly address: number;
  readonly data: Uint8Array;
}

export interface FirmwareImage {
  readonly kind: ImageKind;
  readonly segments: readonly FirmwareSegment[];
  readonly startAddress: number;
  readonly endAddressExclusive: number;
  readonly totalBytes: number;
  readonly sourceName: string | null;
}

/** Application image, always programmed at 0x08004000. */
export function createFirmwareImage(
  bytes: Uint8Array,
  sourceName: string | null = null,
): FirmwareImage {
  if (bytes.length === 0) {
    throw new ValidationError('The firmware binary is empty.');
  }
  const data = bytes.slice();
  return {
    kind: 'application',
    segments: [{ address: APP_BASE, data }],
    startAddress: APP_BASE,
    endAddressExclusive: APP_BASE + data.length,
    totalBytes: data.length,
    sourceName,
  };
}

/**
 * Full-chip image, programmed at 0x08000000. The file must be exactly one
 * flash worth of bytes and must contain the expected flash bootloader and
 * application vector tables; otherwise it is rejected.
 */
export function createFullChipImage(
  bytes: Uint8Array,
  geometry: FlashGeometry,
  sram: { start: number; end: number },
  sourceName: string | null = null,
): FirmwareImage {
  if (bytes.length !== geometry.flashBytes) {
    throw new ValidationError(
      `A full-chip image must be exactly ${geometry.flashBytes.toLocaleString()} bytes, ` +
        `but the file is ${bytes.length.toLocaleString()} bytes.`,
    );
  }
  // Throws unless the file has the known flash bootloader + application layout.
  assertKnownLayout(bytes, geometry.flashBase, geometry, sram);

  const data = bytes.slice();
  return {
    kind: 'fullchip',
    segments: [{ address: FLASH_BOOTLOADER_BASE, data }],
    startAddress: FLASH_BOOTLOADER_BASE,
    endAddressExclusive: FLASH_BOOTLOADER_BASE + data.length,
    totalBytes: data.length,
    sourceName,
  };
}

/** Ensure the image fits the chip and respects the app/full-chip write policy. */
export function assertFirmwareFits(image: FirmwareImage, geometry: FlashGeometry): void {
  if (image.totalBytes <= 0) {
    throw new ValidationError('The firmware image is empty.');
  }
  const allowFlashBootloader = image.kind === 'fullchip';
  for (const segment of image.segments) {
    try {
      assertImageRange(segment.address, segment.data.length, geometry, { allowFlashBootloader });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ValidationError(
        `Firmware at ${formatAddress(segment.address)} cannot be written: ${detail}`,
      );
    }
  }
}
