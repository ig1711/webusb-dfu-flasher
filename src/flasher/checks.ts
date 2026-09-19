/**
 * Ordered, fail-fast device verification.
 *
 * Every check is run only after the previous one passes, so an unsupported
 * protection state stops the sequence before any flash read or write. The
 * resulting `VerifiedDevice` is the only thing that unlocks the rest of the UI.
 */

import { APP_BASE, FLASH_BOOTLOADER_BASE, FLASH_BOOTLOADER_SIZE } from '../dfu/codes';
import { identifyChip, type RomBootloaderAccess, type ChipIdentity } from '../dfu/descriptors';
import { isWritableLevel, type F350OptionBytes, type ProtectionLevel } from '../dfu/optionBytes';
import type { DfuSession } from '../dfu/session';
import { formatAddress, assertValidGeometry, type FlashGeometry } from '../dfu/validate';
import { geometryFor, sramRangeFor } from '../chip/geometry';
import { assertKnownLayout, type LayoutFingerprint } from '../chip/layout';
import type { F350Part } from '../chip/f350';

export type CheckId = 'identity' | 'geometry' | 'protection' | 'flash-bootloader-layout' | 'rom-bootloader-access';

export interface CheckOutcome {
  id: CheckId;
  label: string;
  status: 'pass' | 'fail';
  detail: string;
}

export interface VerifiedDevice {
  identity: ChipIdentity;
  part: F350Part;
  geometry: FlashGeometry;
  sram: { start: number; end: number };
  optionBytes: F350OptionBytes;
  protection: ProtectionLevel;
  romBootloaderAccess: RomBootloaderAccess;
  layout: LayoutFingerprint;
  /** First 16 KB of main flash (the flash bootloader), as read during checks. */
  flashBootloader: Uint8Array;
}

export class DeviceCheckError extends Error {
  constructor(
    readonly checkId: CheckId,
    message: string,
  ) {
    super(message);
    this.name = 'DeviceCheckError';
  }
}

export interface RunChecksOptions {
  onOutcome?: (outcome: CheckOutcome) => void;
  signal?: AbortSignal;
}

export async function runDeviceChecks(
  session: DfuSession,
  options: RunChecksOptions = {},
): Promise<VerifiedDevice> {
  const report = (outcome: CheckOutcome) => options.onOutcome?.(outcome);

  function fail(id: CheckId, label: string, detail: string): never {
    report({ id, label, status: 'fail', detail });
    throw new DeviceCheckError(id, detail);
  }

  const device = session.usbDevice;
  if (!device) fail('identity', 'Chip model', 'No device is connected.');

  // 1. Identity: MCUID must resolve to a GD32F350 part.
  const identity = await identifyChip(device);
  if (!identity.part) {
    fail(
      'identity',
      'Chip model',
      identity.mcuid
        ? `Unsupported chip (MCU ID ${identity.mcuid}). Only GD32F350 is supported.`
        : 'Could not read the MCU ID; unsupported device.',
    );
  }
  const part = identity.part;
  report({
    id: 'identity',
    label: 'Chip model',
    status: 'pass',
    detail: `${part.partNumber} (MCU ID ${identity.mcuid})`,
  });

  // 2. Geometry: must have an application region above the flash bootloader.
  const geometry = geometryFor(part);
  const sram = sramRangeFor(part);
  try {
    assertValidGeometry(geometry);
  } catch (error) {
    fail('geometry', 'Memory geometry', error instanceof Error ? error.message : String(error));
  }
  if (geometry.flashBytes <= FLASH_BOOTLOADER_SIZE) {
    fail(
      'geometry',
      'Memory geometry',
      `${part.flashKb} KB flash leaves no application region above the 16 KB flash bootloader.`,
    );
  }
  report({
    id: 'geometry',
    label: 'Memory geometry',
    status: 'pass',
    detail: `${part.flashKb} KB flash, ${part.sramKb} KB SRAM`,
  });

  // 3. Protection: SPC must be none (0xA5) or low (0xBB) with a valid complement.
  let optionBytes: F350OptionBytes;
  try {
    optionBytes = await session.loadOptionBytes(geometry, options.signal);
  } catch (error) {
    fail('protection', 'Security protection', error instanceof Error ? error.message : String(error));
  }
  if (!optionBytes.spcComplementValid) {
    fail(
      'protection',
      'Security protection',
      `Option bytes are inconsistent (SPC 0x${optionBytes.spc
        .toString(16)
        .toUpperCase()} / complement 0x${optionBytes.spcComplement.toString(16).toUpperCase()}).`,
    );
  }
  if (!isWritableLevel(optionBytes.level)) {
    fail(
      'protection',
      'Security protection',
      optionBytes.level === 'high'
        ? 'High protection (0xCC) is set and is irreversible. This device is not supported.'
        : `Unsupported protection value 0x${optionBytes.spc.toString(16).toUpperCase()}.`,
    );
  }
  report({
    id: 'protection',
    label: 'Security protection',
    status: 'pass',
    detail: optionBytes.level === 'none' ? 'None (0xA5)' : 'Low (0xBB)',
  });

  // 4. Layout: vector table fingerprint. A successful read proves the ROM DFU
  //    bootloader (system memory, outside flash) serves flash.
  const windowLength = APP_BASE - FLASH_BOOTLOADER_BASE + 64;
  let window: Uint8Array;
  try {
    window = await session.readFlash(FLASH_BOOTLOADER_BASE, windowLength, geometry, { signal: options.signal });
  } catch (error) {
    fail(
      'flash-bootloader-layout',
      'Flash bootloader layout',
      `Could not read flash to verify the layout: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let layout: LayoutFingerprint;
  try {
    layout = assertKnownLayout(window, FLASH_BOOTLOADER_BASE, geometry, sram);
  } catch (error) {
    fail(
      'flash-bootloader-layout',
      'Flash bootloader layout',
      error instanceof Error ? error.message : String(error),
    );
  }
  report({
    id: 'flash-bootloader-layout',
    label: 'Flash bootloader layout',
    status: 'pass',
    detail: `16 KB flash bootloader at ${formatAddress(FLASH_BOOTLOADER_BASE)}, application at ${formatAddress(APP_BASE)}`,
  });

  // 5. ROM DFU bootloader access axis (hint from string 5, confirmed by the read above).
  const romBootloaderAccess: RomBootloaderAccess = 'accessible';
  report({
    id: 'rom-bootloader-access',
    label: 'ROM DFU bootloader access',
    status: 'pass',
    detail: identity.romBootloaderAccess === 'blocked' ? 'Accessible (string hint disagreed)' : 'Accessible',
  });

  return {
    identity,
    part,
    geometry,
    sram,
    optionBytes,
    protection: optionBytes.level,
    romBootloaderAccess,
    layout,
    flashBootloader: window.slice(0, FLASH_BOOTLOADER_SIZE),
  };
}
