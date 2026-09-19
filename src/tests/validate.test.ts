import { describe, expect, it } from 'vitest';
import {
  assertAppRange,
  assertFlashRange,
  assertPageAligned,
  formatAddress,
  overlapsOptionBytes,
  pagesForRange,
  type FlashGeometry,
} from '../dfu/validate';
import { APP_BASE } from '../dfu/codes';
import { ValidationError } from '../dfu/errors';

const geometry: FlashGeometry = {
  flashBase: 0x0800_0000,
  flashBytes: 64 * 1024,
  pageSize: 1024,
  optionByteBase: 0x1fff_f800,
  optionByteBytes: 16,
};

describe('formatAddress', () => {
  it('pads to eight hex digits', () => {
    expect(formatAddress(APP_BASE)).toBe('0x08004000');
  });
});

describe('assertFlashRange', () => {
  it('accepts reads anywhere in flash, including the bootloader', () => {
    expect(() => assertFlashRange(0x0800_0000, 16, geometry)).not.toThrow();
    expect(() => assertFlashRange(geometry.flashBase + geometry.flashBytes - 1, 1, geometry)).not.toThrow();
  });

  it('rejects ranges past the end of flash', () => {
    expect(() => assertFlashRange(geometry.flashBase + geometry.flashBytes - 1, 2, geometry)).toThrow(
      /exceeds the flash end/i,
    );
  });

  it('rejects zero/negative/non-integer lengths', () => {
    expect(() => assertFlashRange(APP_BASE, 0, geometry)).toThrow(ValidationError);
    expect(() => assertFlashRange(APP_BASE, -4, geometry)).toThrow(ValidationError);
    expect(() => assertFlashRange(APP_BASE, 1.5, geometry)).toThrow(ValidationError);
  });

  it('rejects ranges that overlap option bytes', () => {
    const embedded: FlashGeometry = { ...geometry, flashBase: 0x1fff_0000, flashBytes: 0x10000 };
    expect(() => assertFlashRange(0x1fff_f800, 16, embedded)).toThrow(/option-byte/i);
    expect(overlapsOptionBytes(0x1fff_f800, 4, embedded)).toBe(true);
  });
});

describe('assertAppRange', () => {
  it('rejects the bootloader region', () => {
    expect(() => assertAppRange(0x0800_0000, 16, geometry)).toThrow(/bootloader region/i);
    expect(() => assertAppRange(0x0800_3fff, 1, geometry)).toThrow(/bootloader region/i);
  });

  it('accepts the application region', () => {
    expect(() => assertAppRange(APP_BASE, 16, geometry)).not.toThrow();
    expect(() => assertAppRange(geometry.flashBase + geometry.flashBytes - 4, 4, geometry)).not.toThrow();
  });
});

describe('assertPageAligned', () => {
  it('accepts aligned addresses and rejects unaligned ones', () => {
    expect(() => assertPageAligned(0x0800_0400, geometry)).not.toThrow();
    expect(() => assertPageAligned(0x0800_0401, geometry)).toThrow(/not aligned/i);
  });
});

describe('pagesForRange', () => {
  it('returns every touched application page', () => {
    expect(pagesForRange(APP_BASE, 1, geometry)).toEqual([APP_BASE]);
    expect(pagesForRange(APP_BASE + 1, 1024, geometry)).toEqual([APP_BASE, APP_BASE + 0x400]);
  });

  it('refuses to erase a page inside the bootloader', () => {
    expect(() => pagesForRange(0x0800_0000, 1024, geometry)).toThrow(/bootloader/i);
  });
});
