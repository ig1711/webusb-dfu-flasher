/**
 * GD32F350 identification. The tool supports only this family.
 */

import { F350_PARTS, type F350Part } from './f350';

export function normalizeMcuid(mcuid: string): string {
  return mcuid.trim().toUpperCase();
}

/** Returns the F350 part for an MCUID, or `null` for any other family. */
export function findF350Part(mcuid: string): F350Part | null {
  const key = normalizeMcuid(mcuid);
  if (!key) return null;
  return F350_PARTS[key] ?? null;
}

export function isF350(mcuid: string): boolean {
  return findF350Part(mcuid) !== null;
}
