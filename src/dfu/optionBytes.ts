/**
 * GD32F350 (GD32F3x0) option bytes.
 *
 * Layout at 0x1FFFF800 (each value byte is followed by its complement):
 *   0x00 SPC      | 0x01 SPC_N
 *   0x02 USER     | 0x03 USER_N
 *   0x04 DATA0    | 0x05 DATA0_N
 *   0x06 DATA1    | 0x07 DATA1_N
 *   0x08 WP0      | 0x09 WP0_N
 *   0x0A WP1      | 0x0B WP1_N
 *   0x0C..0x0F reserved (0xFF)
 *
 * The security protection code (SPC) is `0xA5` (none), `0xBB` (low) or `0xCC`
 * (high). Per the GD32F3x0 FMC driver, the SPC byte cannot be reprogrammed once
 * high protection is set.
 */

import { OPTION_BYTE_LENGTH } from './codes';
import { ValidationError } from './errors';

export const SPC_NONE = 0xa5;
export const SPC_LOW = 0xbb;
export const SPC_HIGH = 0xcc;

/** USER bits 3 and 7 are reserved on the GD32F3x0. */
export const USER_RESERVED_MASK = 0x88;

export type ProtectionLevel = 'none' | 'low' | 'high' | 'invalid';

function pairValid(value: number, complement: number): boolean {
  return ((value ^ complement) & 0xff) === 0xff;
}

export function classifySpc(spc: number): ProtectionLevel {
  if (spc === SPC_NONE) return 'none';
  if (spc === SPC_HIGH) return 'high';
  return 'low';
}

export interface F350OptionBytes {
  raw: Uint8Array;
  spc: number;
  spcComplement: number;
  spcComplementValid: boolean;
  level: ProtectionLevel;
  user: number;
  userComplementValid: boolean;
  data0: number;
  data0ComplementValid: boolean;
  data1: number;
  data1ComplementValid: boolean;
  wp0: number;
  wp0ComplementValid: boolean;
  wp1: number;
  wp1ComplementValid: boolean;
  /** True only when every value/complement pair is consistent. */
  allComplementsValid: boolean;
}

export function decodeOptionBytes(raw: Uint8Array): F350OptionBytes {
  if (raw.length < OPTION_BYTE_LENGTH) {
    throw new ValidationError(`Option bytes must be ${OPTION_BYTE_LENGTH} bytes long.`);
  }

  const spcComplementValid = pairValid(raw[0], raw[1]);
  const userComplementValid = pairValid(raw[2], raw[3]);
  const data0ComplementValid = pairValid(raw[4], raw[5]);
  const data1ComplementValid = pairValid(raw[6], raw[7]);
  const wp0ComplementValid = pairValid(raw[8], raw[9]);
  const wp1ComplementValid = pairValid(raw[10], raw[11]);

  return {
    raw,
    spc: raw[0],
    spcComplement: raw[1],
    spcComplementValid,
    level: spcComplementValid ? classifySpc(raw[0]) : 'invalid',
    user: raw[2],
    userComplementValid,
    data0: raw[4],
    data0ComplementValid,
    data1: raw[6],
    data1ComplementValid,
    wp0: raw[8],
    wp0ComplementValid,
    wp1: raw[10],
    wp1ComplementValid,
    allComplementsValid:
      spcComplementValid &&
      userComplementValid &&
      data0ComplementValid &&
      data1ComplementValid &&
      wp0ComplementValid &&
      wp1ComplementValid,
  };
}

export interface F350OptionByteValues {
  spc: number;
  user: number;
  data0: number;
  data1: number;
  wp0: number;
  wp1: number;
}

export function encodeOptionBytes(values: F350OptionByteValues): Uint8Array {
  const bytes = new Uint8Array(OPTION_BYTE_LENGTH).fill(0xff);
  const writePair = (index: number, value: number) => {
    const masked = value & 0xff;
    bytes[index] = masked;
    bytes[index + 1] = ~masked & 0xff;
  };

  writePair(0, values.spc);
  writePair(2, values.user);
  writePair(4, values.data0);
  writePair(6, values.data1);
  writePair(8, values.wp0);
  writePair(10, values.wp1);
  return bytes;
}

/**
 * Merge a change into the current option bytes, preserving reserved USER bits
 * and any field the patch omits.
 */
export function applyOptionBytePatch(
  current: F350OptionBytes,
  patch: Partial<F350OptionByteValues>,
): F350OptionByteValues {
  const user =
    patch.user === undefined
      ? current.user
      : (current.user & USER_RESERVED_MASK) | (patch.user & ~USER_RESERVED_MASK & 0xff);

  return {
    spc: patch.spc ?? current.spc,
    user,
    data0: patch.data0 ?? current.data0,
    data1: patch.data1 ?? current.data1,
    wp0: patch.wp0 ?? current.wp0,
    wp1: patch.wp1 ?? current.wp1,
  };
}

export function isWritableLevel(level: ProtectionLevel): boolean {
  return level === 'none' || level === 'low';
}
