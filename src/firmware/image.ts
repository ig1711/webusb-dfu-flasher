/**
 * Firmware images.
 *
 * Only the `application` kind is supported: a raw update binary programmed at
 * APP_BASE (0x08004000). The flash bootloader region cannot be erased or
 * written by the bootloader itself, so full-chip restore is deliberately not
 * offered (see the repo docs).
 */

import { APP_BASE } from '../dfu/codes';
import { ValidationError } from '../dfu/errors';
import { assertAppRange, formatAddress, type FlashGeometry } from '../dfu/validate';

export interface FirmwareSegment {
  readonly address: number;
  readonly data: Uint8Array;
}

export interface FirmwareImage {
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
    segments: [{ address: APP_BASE, data }],
    startAddress: APP_BASE,
    endAddressExclusive: APP_BASE + data.length,
    totalBytes: data.length,
    sourceName,
  };
}

/** Ensure the image fits the application region above the 16 KB flash bootloader. */
export function assertFirmwareFits(image: FirmwareImage, geometry: FlashGeometry): void {
  if (image.totalBytes <= 0) {
    throw new ValidationError('The firmware image is empty.');
  }
  for (const segment of image.segments) {
    try {
      assertAppRange(segment.address, segment.data.length, geometry);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ValidationError(
        `Firmware at ${formatAddress(segment.address)} cannot be written: ${detail}`,
      );
    }
  }
}
