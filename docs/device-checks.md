# Device checks

A single **Connect & verify** action runs every check below, in order, and
stops at the first failure. Nothing else on the page is enabled until every
check passes.

## Order and failure behaviour

| # | Check | Passes when | On failure |
|---|-------|-------------|------------|
| 1 | WebUSB environment | `navigator.usb` exists (Chrome/Edge, HTTPS or localhost) | Connect button disabled |
| 2 | USB identity | device is `28e9:0189` and the interface is claimed | stops, stays disconnected |
| 3 | Chip model | MCU ID resolves to a GD32F350 part | stops before any flash access |
| 4 | Memory geometry | flash/SRAM/page size valid and an application region exists above the 16 KB flash bootloader | stops |
| 5 | Security protection | `OB_SPC` is `0xA5` or `0xBB` **and** its complement is valid | stops before any flash read |
| 6 | Flash bootloader layout | flash vector tables at exactly `0x08000000` and `0x08004000`, none between | stops |
| 7 | ROM DFU bootloader access | the layout read succeeded (the ROM bootloader serves flash) | stops |

Checks 3–7 fail fast: for example, a high (`0xCC`) or inconsistent protection
value exits at check 5, before any flash is read.

## Why protection is checked before the layout

Reading an option byte is one small transfer. Refusing unsupported protection
states first means the tool never reads or writes flash on a device it will not
support.

## Staying connected on failure

A failed check leaves the device connected but locked. The panel shows which
check failed and why, and a **Reconnect** button re-runs the whole pipeline.

## Backup requirement (application page only)

On the **Flash application** page, writes and option-byte edits stay disabled
until you have performed **Read full flash (backup)** at least once. Completion
is recorded in `localStorage` (`gd32f350.dfu.dumpedDevices`) keyed by part
number, so a refresh does not force another dump. The **Full-chip restore** page
does not require a backup.
