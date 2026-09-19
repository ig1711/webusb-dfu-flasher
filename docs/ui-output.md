# What the outputs mean

## Top bar

Navigation switches between **Flash application** (`/`) and **Full-chip
restore** (`/fullchip`). A banner appears if WebUSB is unavailable.

## Device card

| Field | Meaning |
|-------|---------|
| **Part number** | GD32F350 variant resolved from the MCU ID. |
| **MCU ID** | Four-character ID reported by the ROM bootloader. |
| **Flash** | Total main-flash size of the part. |
| **Page size** | Erase granularity (1024 bytes on these parts). |
| **Security protection** | `OB_SPC` decoded: None `0xA5`, Low `0xBB`, High `0xCC`, or Invalid. |
| **ROM DFU bootloader access** | Whether the ROM bootloader (system memory, outside flash) serves flash. `Accessible` after a successful layout read. |
| **Flash bootloader (protected)** | The `0x08000000–0x08003FFF` region inside main flash. |
| **Application base** | Always `0x08004000`, shown for reference only. |

## Verification panel

Each check shows `✓` (pass) or `✕` (fail) with a short explanation:

- **Chip model** — MCU ID maps to a supported GD32F350 part.
- **Memory geometry** — flash/SRAM/page size valid, room for an application.
- **Security protection** — SPC is `0xA5`/`0xBB` with a valid complement.
- **Flash bootloader layout** — vector tables confirm the 16 KB flash
  bootloader and the `0x08004000` application.
- **ROM DFU bootloader access** — the layout read succeeded.

## Flash application page

| Field | Meaning |
|-------|---------|
| **Source** | File name of the loaded `.bin`. |
| **Address** | Always `0x08004000`. |
| **End / Size** | Last address and length of the image. |

Controls: **Erase application pages before writing**, **Verify after writing**,
**Reboot to firmware when done**, **Write firmware**, **Read full flash
(backup)**, **Option bytes…**, **Reboot device**. Until a backup has been taken
once for the model, only **Read full flash** is enabled.

## Full-chip restore page

| Field | Meaning |
|-------|---------|
| **Full-chip toggle** | Must be on before a file can be loaded; marks it as a complete flash image. |
| **Address** | `0x08000000` (includes the flash bootloader). |
| **Size** | Must equal the chip's flash size exactly. |
| **Match banner** | Whether the file's flash bootloader matches the device. |

Controls: **Restore full chip** (needs `FULLCHIP` typed), **Read full flash
(backup)**, **Reboot device**. Verification is always performed; no backup is
required on this page.

## Progress bar

`Idle`, then a phase and percentage: **Erasing** (0–20 %), **Writing**
(20–100 %), **Verifying**, **Reading**. The line also shows bytes done / total
and the current address when available.

## Log

- **info** — connection and state transitions.
- **success** — checks passed, write/verify/read complete.
- **warn** — backup required, protection notices, bootloader mismatch, unplug.
- **error** — check failures, write/verify failures, partial writes.

## Errors you may see

| Message | Cause / action |
|---------|----------------|
| `Unsupported chip (MCU ID …)` | Not a GD32F350; the tool will not proceed. |
| `High protection (0xCC) is set…` | Unsupported, irreversible state. |
| `Option bytes are inconsistent…` | SPC value/complement mismatch; device not touched. |
| `No valid application vector table at 0x08004000…` | Unexpected layout; the tool will not write. |
| `… inside the protected flash bootloader region…` | The application page refuses to write the bootloader; use the full-chip page for a full image. |
| `A full-chip image must be exactly … bytes` | Full-chip file size does not match the chip. |
| `Flash was partially written…` | The write was interrupted after modifying flash; retry. |
