# Documentation

This folder documents the GD32F350 WebUSB flasher: what it checks, what it
refuses to do, and what every output means.

## Two bootloaders

- **ROM DFU bootloader** — lives in the chip's system memory, *outside* main
  flash. This is the USB device (`28e9:0189`) the tool talks to. It cannot be
  overwritten.
- **Flash bootloader** — user code stored in the first 16 KB of main flash at
  `0x08000000`. It is part of the flash dump and, on the full-chip restore page
  only, can be overwritten.

## Pages

- **Flash application** (`/`) — writes an update binary at `0x08004000`, never
  touches the flash bootloader.
- **Full-chip restore** (`/fullchip`) — explicitly restores a complete flash
  image from `0x08000000`, including the flash bootloader.

## Files

- [device-checks.md](./device-checks.md) — connect-and-verify pipeline.
- [bootloader-layout.md](./bootloader-layout.md) — fixed flash layout.
- [full-chip-restore.md](./full-chip-restore.md) — restoring a full dump and its risks.
- [gd32f350.md](./gd32f350.md) — option bytes and the two protection axes.
- [ui-output.md](./ui-output.md) — what each field, phase, log line and error means.
- [firmware-prep.md](./firmware-prep.md) — preparing the update binary.
- [sources.md](./sources.md) — where the technical claims come from.
