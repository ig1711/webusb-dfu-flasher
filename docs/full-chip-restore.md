# Full-chip restore

The **Full-chip restore** page (`/fullchip`) writes a complete flash image
starting at `0x08000000`, including the 16 KB flash bootloader.

## When to use it

- Recovering a device whose flash bootloader or application is corrupt.
- Restoring a backup taken with **Read full flash** on the application page.
- Cloning a known-good device onto an identical model.

## Required file

- A raw `.bin` that is **exactly one flash** in size (e.g. 65,536 bytes for the
  64 KB F350R8).
- It must contain valid vector tables at file offsets `0` and `0x4000`; files
  without the expected layout are rejected.
- No base address is entered; it is read from `0x08000000`.

## Safety features

- **Explicit toggle**: nothing on this page is treated as full-chip until you
  tick "This file is a full-chip backup".
- **Bootloader comparison**: the file's first 16 KB is compared with the
  device's current flash bootloader. A match is reported; a mismatch or an
  unavailable comparison is warned about but not blocked.
- **Typed confirmation**: you must type `FULLCHIP` before the restore button
  enables.
- **Forced verification**: full-chip writes are always read back and verified.
- **No backup required** on this page.

## Risks

- If the image is wrong or the write is interrupted, the device will not boot.
- Recovery is still possible because the ROM DFU bootloader is in system
  memory: drive BOOT0 high, reset, and reflash over `28e9:0189`. This may
  require physical access to the board.
- Option bytes are **not** part of a flash dump, so protection state is not
  restored. Use the Option bytes dialog separately if needed.
