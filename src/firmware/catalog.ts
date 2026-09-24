/**
 * Static firmware catalog for the Huion HS611 page.
 *
 * Each entry points at a file served from `public/` and pins its size and
 * SHA-256 so a tampered or stale asset is refused before it reaches the
 * device. To ship a new build, drop the `.bin` in `public/` and add an entry
 * below; the page's searchable combobox picks it up automatically.
 */

export interface Hs611Firmware {
  /** Stable id, also used for DOM ids in the combobox. */
  id: string;
  /** Short name shown as the selected value. */
  label: string;
  /** One-line description shown beneath the label. */
  description: string;
  /** Absolute URL of the binary under `public/`. */
  file: string;
  /** Lowercase hex SHA-256 of the file. */
  sha256: string;
  /** Exact file length in bytes. */
  bytes: number;
}

export const HS611_FIRMWARES: readonly Hs611Firmware[] = [
  {
    id: 'hs611-480hz',
    label: 'HS611 480 Hz',
    description: 'Low Latency and Stable (Debloated + Smoothing Removed)',
    file: '/GD32F350R8T6_app.penonly.bin',
    sha256: 'e8c70cda1a3e3ee4ba2007cd5454e306fbc8b2c77a7d1d496ca3585c5bd4efe4',
    bytes: 49152,
  },
  {
    id: 'hs611-1000hz',
    label: 'HS611 1000 Hz (Unstable)',
    description: 'Custom Firmware (Position Only, No Tip)',
    file: '/GD32F350R8T6_app.cfw.bin',
    sha256: '0e5301d846912c8144eddb3aa669aa46a42e95e3b0229d3931f21201b68e53cf',
    bytes: 19692,
  },
  {
    id: 'hs611-stock',
    label: 'HS611 Stock (Original)',
    description: 'Factory firmware, unmodified',
    file: '/GD32F350R8T6_app.original.bin',
    sha256: '8be9f0812baa9f83df025fbd39af8b620234ae364c51e687bfe06817dc367a73',
    bytes: 49152,
  },
];
