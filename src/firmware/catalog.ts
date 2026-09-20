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
    sha256: 'fe6fe43a8d718022fe0c9661cc96dc85580069a1a9077996241ce070b9ffe625',
    bytes: 49152,
  },
];
