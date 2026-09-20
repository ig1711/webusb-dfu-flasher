/**
 * SHA-256 helper for verifying statically served firmware assets before they
 * are handed to the flasher.
 */

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'SHA-256 is unavailable in this browser. Use Chrome or Edge on a secure (HTTPS or localhost) origin.',
    );
  }
  const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
