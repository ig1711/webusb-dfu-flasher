# PLAN — GD32F350 WebUSB Flasher (SolidJS)

## Scope
Support **only** GD32F350 tablets with the known layout: a 16 KB **flash
bootloader** in main flash at `0x08000000`, application at `0x08004000`. The
**ROM DFU bootloader** lives in system memory outside flash and is the USB
device we talk to.

Two pages:
- **Flash application** (`/`): writes a `.bin` update at `0x08004000`; the flash
  bootloader is never written.
- **Full-chip restore** (`/fullchip`): explicit restore of a complete flash
  image from `0x08000000`, including the flash bootloader.

## Locked decisions
- Router: `@solidjs/router` (2.0.0-next, hash history).
- Device: strict filter `28e9:0189`; MCU ID must resolve to an F350 part.
- One **Connect & verify** action per page; everything else disabled until it passes.
- Checks ordered and fail-fast (unsupported protection exits before flash access).
- Application base fixed at `0x08004000`, display-only; no mass erase; `.bin` only.
- Backup required once per model on the application page (localStorage
  `gd32f350.dfu.dumpedDevices`); not required on the full-chip page.
- Full-chip restore is gated by an explicit toggle, exact-one-flash size,
  layout validation, a flash-bootloader match report, and typed `FULLCHIP`
  confirmation; verification is forced.

## Architecture
```
src/
  App.tsx                      # @solidjs/router + nav layout
  pages/  ApplicationPage.tsx, FullChipPage.tsx
  dfu/    codes, errors, usb, validate, optionBytes, descriptors, session
  chip/   f350 (data), lookup, geometry, layout (vector-table fingerprint)
  firmware/image.ts            # application + fullchip image kinds
  flasher/ checks, controller, hotplug, log
  i18n/   strings, context
  components/ TopBar, DeviceCard, FirmwareCard, FlashOps, FullChipCard,
              FullChipOps, ProgressBar, LogTerminal, OptionBytesDialog, SetupNotes
  mocks/ webusb
  tests/ validate, optionBytes, session, layout, checks, fullchip
```

## Naming: two bootloaders
- `FLASH_BOOTLOADER_BASE` / `FLASH_BOOTLOADER_SIZE` — main-flash user bootloader.
- "ROM DFU bootloader" — system-memory USB bootloader (access axis).
All UI, code and docs use these explicit terms.

## Connect & verify pipeline (`flasher/checks.ts`)
1. WebUSB + secure context.
2. USB identity `28e9:0189`.
3. Chip model: MCU ID ∈ F350 whitelist.
4. Geometry valid with an application region above the flash bootloader.
5. Protection: `OB_SPC ∈ {0xA5, 0xBB}` and complement valid (fail fast).
6. Flash bootloader layout: vector tables at `0x08000000` and `0x08004000`.
7. ROM DFU bootloader access: the layout read succeeded.

## Write enforcement
- Application image: `assertAppRange` / `pagesForRange` reject any page below
  `0x08004000`.
- Full-chip image: only when `kind === 'fullchip'`, which requires exact flash
  size and a valid layout; then the same guards allow the flash bootloader.
- Verify-after-write defaults on and is mandatory for full-chip.

## Documentation
`docs/` — README, device-checks, bootloader-layout, full-chip-restore,
gd32f350, ui-output, firmware-prep, sources.

## Verification
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Out of scope
Non-F350 parts, Intel HEX, mass erase, other families, SSR/server, non-English
locales.
