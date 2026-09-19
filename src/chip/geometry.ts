/**
 * Maps an F350 part to the fixed layout this tool supports.
 *
 * The application is always assumed to start at `APP_BASE` (0x08004000), after
 * the 16 KB user bootloader at 0x08000000. This is verified at connect time by
 * the layout fingerprint check; it is not user-configurable.
 */

import {
  APP_BASE,
  FLASH_BOOTLOADER_BASE,
  FLASH_BOOTLOADER_SIZE,
  DEFAULT_OPTION_BYTE_BASE,
  OPTION_BYTE_LENGTH,
  SRAM_BASE,
} from '../dfu/codes';
import type { FlashGeometry } from '../dfu/validate';
import type { F350Part } from './f350';

export { APP_BASE, FLASH_BOOTLOADER_BASE, FLASH_BOOTLOADER_SIZE, SRAM_BASE };

export function geometryFor(part: F350Part): FlashGeometry {
  return {
    flashBase: FLASH_BOOTLOADER_BASE,
    flashBytes: part.flashBytes,
    pageSize: part.pageSize,
    optionByteBase: DEFAULT_OPTION_BYTE_BASE,
    optionByteBytes: OPTION_BYTE_LENGTH,
  };
}

export function sramRangeFor(part: F350Part): { start: number; end: number } {
  return { start: SRAM_BASE, end: SRAM_BASE + part.sramBytes };
}
