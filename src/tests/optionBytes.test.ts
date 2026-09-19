import { describe, expect, it } from 'vitest';
import {
  SPC_HIGH,
  SPC_LOW,
  SPC_NONE,
  applyOptionBytePatch,
  classifySpc,
  decodeOptionBytes,
  encodeOptionBytes,
  isWritableLevel,
  type F350OptionByteValues,
} from '../dfu/optionBytes';

const base: F350OptionByteValues = {
  spc: SPC_NONE,
  user: 0xff,
  data0: 0xff,
  data1: 0xff,
  wp0: 0xff,
  wp1: 0xff,
};

describe('classifySpc', () => {
  it('maps the F350 security protection codes', () => {
    expect(classifySpc(SPC_NONE)).toBe('none');
    expect(classifySpc(SPC_LOW)).toBe('low');
    expect(classifySpc(SPC_HIGH)).toBe('high');
    expect(classifySpc(0x00)).toBe('low');
  });

  it('treats none and low as writable', () => {
    expect(isWritableLevel('none')).toBe(true);
    expect(isWritableLevel('low')).toBe(true);
    expect(isWritableLevel('high')).toBe(false);
    expect(isWritableLevel('invalid')).toBe(false);
  });
});

describe('encodeOptionBytes', () => {
  it('writes value/complement pairs in the F3x0 layout', () => {
    const raw = encodeOptionBytes({ ...base, spc: SPC_LOW, user: 0x01, data0: 0x00, wp0: 0x0f });
    expect([...raw]).toEqual([
      0xbb, 0x44,
      0x01, 0xfe,
      0x00, 0xff,
      0xff, 0x00,
      0x0f, 0xf0,
      0xff, 0x00,
      0xff, 0xff, 0xff, 0xff,
    ]);
  });
});

describe('decodeOptionBytes', () => {
  it('round-trips and validates complements', () => {
    const decoded = decodeOptionBytes(encodeOptionBytes({ ...base, spc: SPC_LOW, wp0: 0x00, wp1: 0x80 }));
    expect(decoded.spc).toBe(SPC_LOW);
    expect(decoded.level).toBe('low');
    expect(decoded.wp0).toBe(0x00);
    expect(decoded.wp1).toBe(0x80);
    expect(decoded.allComplementsValid).toBe(true);
  });

  it('reports invalid when the SPC complement is wrong', () => {
    const raw = encodeOptionBytes(base);
    raw[1] = 0x00; // SPC is 0xA5 but complement is not 0x5A
    const decoded = decodeOptionBytes(raw);
    expect(decoded.spcComplementValid).toBe(false);
    expect(decoded.level).toBe('invalid');
    expect(decoded.allComplementsValid).toBe(false);
  });
});

describe('applyOptionBytePatch', () => {
  it('preserves reserved USER bits and omitted fields', () => {
    const current = decodeOptionBytes(encodeOptionBytes({ ...base, user: 0xf8 }));
    const next = applyOptionBytePatch(current, { user: 0x01 });
    expect(next.user).toBe(0x89);
    expect(next.spc).toBe(SPC_NONE);
    expect(next.wp0).toBe(0xff);
  });

  it('honours explicit 0x00 values', () => {
    const current = decodeOptionBytes(encodeOptionBytes(base));
    const next = applyOptionBytePatch(current, { data0: 0x00, wp0: 0x00 });
    expect(next.data0).toBe(0x00);
    expect(next.wp0).toBe(0x00);
  });
});
