import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import { HS611_FIRMWARES } from '../firmware/catalog';

describe('HS611 firmware catalog', () => {
  it('has unique ids and absolute asset paths', () => {
    const ids = HS611_FIRMWARES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of HS611_FIRMWARES) {
      expect(entry.file.startsWith('/')).toBe(true);
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  for (const entry of HS611_FIRMWARES) {
    it(`matches the published asset for ${entry.label}`, () => {
      const path = resolve(cwd(), 'public', entry.file.replace(/^\//, ''));
      const bytes = readFileSync(path);
      expect(bytes.length).toBe(entry.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    });
  }
});
