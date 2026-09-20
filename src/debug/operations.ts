/**
 * Capture-rich device probes for the Debug page.
 *
 * These wrap the DfuSession operations so a failure is recorded with its
 * exact DFU status code and state instead of only a thrown message. The
 * protection probe only writes into unused bootloader padding and restores it.
 */

import { DFU_STATE_NAMES, DFU_STATUS_NAMES } from '../dfu/codes';
import { DfuStatusError, isDfuError } from '../dfu/errors';
import type { F350OptionBytes } from '../dfu/optionBytes';
import type { DfuSession } from '../dfu/session';
import { formatAddress, type FlashGeometry } from '../dfu/validate';

function hexByte(value: number): string {
  return `0x${(value & 0xff).toString(16).toUpperCase().padStart(2, '0')}`;
}

function hexBytes(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

export interface AttemptReport {
  operation: string;
  ok: boolean;
  message: string;
  errorName?: string;
  errorKind?: string;
  statusCode?: number;
  statusName?: string;
  stateCode?: number;
  stateName?: string;
}

function captureError(report: AttemptReport, error: unknown): void {
  report.errorName = error instanceof Error ? error.name : typeof error;
  if (isDfuError(error)) report.errorKind = error.kind;
  if (error instanceof DfuStatusError) {
    report.statusCode = error.code;
    report.statusName = DFU_STATUS_NAMES[error.code] ?? `code ${error.code}`;
  }
  report.message = error instanceof Error ? error.message : String(error);
}

async function captureState(session: DfuSession, report: AttemptReport): Promise<void> {
  try {
    const status = await session.readStatus();
    report.stateCode = status.state;
    report.stateName = DFU_STATE_NAMES[status.state] ?? `state ${status.state}`;
    if (report.statusCode === undefined) {
      report.statusCode = status.code;
      report.statusName = DFU_STATUS_NAMES[status.code] ?? `code ${status.code}`;
    }
  } catch (error) {
    report.message += ` [state read failed: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

export function formatAttempt(report: AttemptReport): string {
  const lines = [`${report.operation}`];
  lines.push(`  result      ${report.ok ? 'ACCEPTED' : 'REJECTED'}`);
  if (report.errorName) {
    lines.push(`  error       ${report.errorName}${report.errorKind ? ` (kind=${report.errorKind})` : ''}`);
  }
  if (report.statusCode !== undefined) {
    lines.push(`  DFU status  ${report.statusName ?? '?'} (${report.statusCode})`);
  }
  if (report.stateCode !== undefined) {
    lines.push(`  DFU state   ${report.stateName ?? '?'} (${report.stateCode})`);
  }
  lines.push(`  message     ${report.message}`);
  return lines.join('\n');
}

async function cleanup(session: DfuSession): Promise<void> {
  try {
    await session.recoverToIdle();
  } catch {
    // best effort; the caller reports the captured error regardless
  }
}

/** Attempt an ERASE and capture the exact DFU outcome. */
export async function attemptErase(
  session: DfuSession,
  address: number,
  geometry: FlashGeometry,
): Promise<AttemptReport> {
  const report: AttemptReport = {
    operation: `ERASE ${formatAddress(address)}`,
    ok: false,
    message: '',
  };
  try {
    await session.eraseSector(address, geometry);
    report.ok = true;
    report.message = 'The device accepted the erase command.';
    return report;
  } catch (error) {
    captureError(report, error);
    await captureState(session, report);
    await cleanup(session);
    return report;
  }
}

/** Attempt a raw program and capture the exact DFU outcome. */
export async function attemptWrite(
  session: DfuSession,
  address: number,
  data: Uint8Array,
): Promise<AttemptReport> {
  const report: AttemptReport = {
    operation: `WRITE ${data.length} byte(s) @ ${formatAddress(address)}`,
    ok: false,
    message: '',
  };
  try {
    await session.writeRaw(address, data);
    report.ok = true;
    report.message = 'The device accepted the program command.';
    return report;
  } catch (error) {
    captureError(report, error);
    await captureState(session, report);
    await cleanup(session);
    return report;
  }
}

/** Read option bytes and decode every field, both raw and per the FMC rules. */
export interface OptionBytesReadReport {
  ok: boolean;
  rawHex: string;
  optionBytes: F350OptionBytes | null;
  text: string;
}

export async function readOptionBytesRaw(
  session: DfuSession,
  geometry: FlashGeometry,
): Promise<OptionBytesReadReport> {
  try {
    const optionBytes = await session.loadOptionBytes(geometry);
    return {
      ok: true,
      rawHex: hexBytes(optionBytes.raw),
      optionBytes,
      text: formatOptionBytes(optionBytes),
    };
  } catch (error) {
    const attempt: AttemptReport = {
      operation: `READ option bytes @ ${formatAddress(geometry.optionByteBase)}`,
      ok: false,
      message: '',
    };
    captureError(attempt, error);
    await captureState(session, attempt);
    await cleanup(session);
    return {
      ok: false,
      rawHex: '',
      optionBytes: null,
      text: `Option-byte read failed.\n\n${formatAttempt(attempt)}`,
    };
  }
}

function describeLevel(level: F350OptionBytes['level']): string {
  switch (level) {
    case 'none':
      return 'none (0xA5)';
    case 'low':
      return 'low (any value except 0xA5/0xCC)';
    case 'high':
      return 'high (0xCC)';
    default:
      return 'invalid (value/complement mismatch)';
  }
}

function pairLabel(value: number, valueComplement: number, valid: boolean): string {
  if ((value & 0xff) === 0xff && (valueComplement & 0xff) === 0xff) return 'unprogrammed (0xFF)';
  return valid ? 'valid' : 'INVALID';
}

export function formatOptionBytes(optionBytes: F350OptionBytes): string {
  const lines: string[] = [];
  lines.push(`Raw (${optionBytes.raw.length} bytes): ${hexBytes(optionBytes.raw)}`);
  lines.push('');
  lines.push(`SPC  byte[0]       ${hexByte(optionBytes.spc)}`);
  lines.push(`     byte[1]       ${hexByte(optionBytes.spcComplement)} (complement)`);
  lines.push(`     pair valid    ${optionBytes.spcComplementValid ? 'yes' : 'NO'}`);
  lines.push(
    `     OB_SPC REG16  0x${((optionBytes.spc | (optionBytes.spcComplement << 8)) >>> 0)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0')}  (little-endian value|complement)`,
  );
  lines.push(`     classified    ${describeLevel(optionBytes.level)}`);
  lines.push('');
  lines.push('  Rule (GD32F3x0 FMC): 0xA5 = none, 0xCC = high, anything else = low.');
  lines.push('  0xBB is the conventional low value, not a special case.');
  lines.push('');
  lines.push(`USER   ${hexByte(optionBytes.user)} / ${hexByte(optionBytes.raw[3] ?? 0xff)}   ${pairLabel(optionBytes.user, optionBytes.raw[3] ?? 0xff, optionBytes.userComplementValid)}`);
  lines.push(`DATA0  ${hexByte(optionBytes.data0)} / ${hexByte(optionBytes.raw[5] ?? 0xff)}   ${pairLabel(optionBytes.data0, optionBytes.raw[5] ?? 0xff, optionBytes.data0ComplementValid)}`);
  lines.push(`DATA1  ${hexByte(optionBytes.data1)} / ${hexByte(optionBytes.raw[7] ?? 0xff)}   ${pairLabel(optionBytes.data1, optionBytes.raw[7] ?? 0xff, optionBytes.data1ComplementValid)}`);
  lines.push(`WP0    ${hexByte(optionBytes.wp0)} / ${hexByte(optionBytes.raw[9] ?? 0xff)}   ${pairLabel(optionBytes.wp0, optionBytes.raw[9] ?? 0xff, optionBytes.wp0ComplementValid)}`);
  lines.push(`WP1    ${hexByte(optionBytes.wp1)} / ${hexByte(optionBytes.raw[11] ?? 0xff)}   ${pairLabel(optionBytes.wp1, optionBytes.raw[11] ?? 0xff, optionBytes.wp1ComplementValid)}`);
  lines.push('');
  lines.push(
    'USER/DATA/WP = 0xFF/0xFF means the field is unprogrammed, not a broken',
  );
  lines.push('complement. Only SPC (BB/44) is programmed on this device.');
  return lines.join('\n');
}

/** Marker written into unused bootloader padding to test write protection. */
export const PROTECTION_MARKER = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x12, 0x34, 0x56, 0x78]);

export interface ProtectionProbeReport {
  text: string;
  writeAccepted: boolean;
  changed: boolean | null;
  eraseAccepted: boolean;
}

interface HexRead {
  ok: boolean;
  hex: string;
  message: string;
}

async function readHex(
  session: DfuSession,
  geometry: FlashGeometry,
  address: number,
  length: number,
): Promise<HexRead> {
  try {
    const data = await session.readFlash(address, length, geometry);
    return { ok: true, hex: hexBytes(data), message: '' };
  } catch (error) {
    return { ok: false, hex: '', message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Write a marker into an (unused) page of the bootloader slot, read it back,
 * then erase the page back to 0xFF. This settles whether the bootloader
 * region is truly write/erase-protected.
 */
export async function probeBootloaderProtection(
  session: DfuSession,
  geometry: FlashGeometry,
  address: number,
): Promise<ProtectionProbeReport> {
  const lines: string[] = [
    `Bootloader-region protection probe @ ${formatAddress(address)}`,
    'Target is the unused 0xFF padding page in the 16 KB bootloader slot',
    '(code ends ~0x08003383). Only this padding is ever touched.',
    '',
  ];

  const before = await readHex(session, geometry, address, PROTECTION_MARKER.length);
  lines.push(`Read before     : ${before.ok ? before.hex : `FAILED (${before.message})`}`);

  const writeReport = await attemptWrite(session, address, PROTECTION_MARKER);
  lines.push('');
  lines.push(formatAttempt(writeReport));

  const afterWrite = await readHex(session, geometry, address, PROTECTION_MARKER.length);
  lines.push('');
  lines.push(`Read after write: ${afterWrite.ok ? afterWrite.hex : `FAILED (${afterWrite.message})`}`);
  const changed = afterWrite.ok && before.ok ? afterWrite.hex !== before.hex : null;
  lines.push(
    `Write changed flash: ${
      changed === null ? 'unknown' : changed ? 'YES - NOT protected' : 'no - silent no-op (protected)'
    }`,
  );

  const eraseReport = await attemptErase(session, address, geometry);
  lines.push('');
  lines.push(formatAttempt(eraseReport));

  const afterErase = await readHex(session, geometry, address, PROTECTION_MARKER.length);
  lines.push('');
  lines.push(`Read after erase: ${afterErase.ok ? afterErase.hex : `FAILED (${afterErase.message})`}`);
  lines.push('');

  if (changed) {
    lines.push('Conclusion: the bootloader region is WRITABLE and ERASABLE. 0x08000000 is');
    lines.push('not protected; a bad write there would brick the device (no debug probe).');
  } else {
    lines.push('Conclusion: the bootloader region is write/erase-protected (silent no-op,');
    lines.push('DFU still reports success). Full-chip restore cannot work; 0x08000000 is');
    lines.push('safe from this tool.');
  }

  return {
    text: lines.join('\n'),
    writeAccepted: writeReport.ok,
    changed,
    eraseAccepted: eraseReport.ok,
  };
}/** Read a window of flash and summarise the vector tables it contains. */
export interface WindowReport {
  ok: boolean;
  text: string;
}

function readWords(window: Uint8Array, offset: number, count: number): string {
  const words: string[] = [];
  for (let index = 0; index < count; index++) {
    const at = offset + index * 4;
    if (at + 4 > window.length) break;
    const value =
      (window[at] | (window[at + 1] << 8) | (window[at + 2] << 16) | (window[at + 3] << 24)) >>> 0;
    words.push(`0x${value.toString(16).toUpperCase().padStart(8, '0')}`);
  }
  return words.join(' ');
}

export async function readWindowReport(
  session: DfuSession,
  geometry: FlashGeometry,
  start: number,
  length: number,
  appBase = 0x0800_4000,
): Promise<WindowReport> {
  try {
    const window = await session.readFlash(start, length, geometry);
    const lines = [
      `Read ${length} bytes (0x${length.toString(16).toUpperCase()}) from ${formatAddress(start)}.`,
      `Words @ ${formatAddress(start)}: ${readWords(window, 0, 8)}`,
    ];
    const appOffset = appBase - start;
    if (appOffset >= 0 && appOffset + 32 <= window.length) {
      lines.push(`Words @ ${formatAddress(appBase)}: ${readWords(window, appOffset, 8)}`);
    }
    return { ok: true, text: lines.join('\n') };
  } catch (error) {
    const attempt: AttemptReport = {
      operation: `READ ${formatAddress(start)} +${length}`,
      ok: false,
      message: '',
    };
    captureError(attempt, error);
    await captureState(session, attempt);
    await cleanup(session);
    return { ok: false, text: formatAttempt(attempt) };
  }
}

/** Read a small raw window (e.g. the option-byte page or 0x08000000). */
export async function readBytesReport(
  session: DfuSession,
  geometry: FlashGeometry,
  address: number,
  length: number,
): Promise<WindowReport> {
  return readWindowReport(session, geometry, address, length);
}
