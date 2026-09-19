# Flash layout

Supported tablets have a fixed main-flash layout:

```
0x08000000 ┌───────────────────────────────┐
           │ flash bootloader (16 KB)      │  protected on the app page
0x08004000 ├───────────────────────────────┤
           │ application / update binary   │  write target for the app page
0x0800FFFF └───────────────────────────────┘   (varies by flash size)
```

The application base is always `0x08004000` and is not user-configurable.

The ROM DFU bootloader is **not** in this map: it lives in the chip's system
memory outside main flash and cannot be overwritten.

## How the layout is verified

The verifier reads `[0x08000000, 0x08004000 + 64)` and looks for Cortex-M
vector tables at page boundaries:

- first word (`SP`) inside SRAM (`0x20000000 .. 0x20000000 + SRAM size`) and
  8-byte aligned;
- second word (reset handler) odd and inside flash;
- at least 8 of the first 16 words are odd flash pointers.

A valid layout has a table at `0x08000000` (flash bootloader) and at
`0x08004000` (application), and no table in between.

On the known tablet (GD32F350R8T6) both tables score 10/16, and the
application region read from the device matches the decrypted vendor update
binary bit-for-bit (MD5 `3007dbf1e0fd4f7cf6aa16ce9b92b2`).

## Write enforcement

- The **Flash application** page always programs at `0x08004000` and refuses
  any page inside the flash bootloader region.
- The **Full-chip restore** page programs from `0x08000000` only when the
  full-chip toggle is on, the file is exactly one flash, and its layout matches.
- Mass erase is intentionally **not implemented**.
- Removing read protection (`OB_SPC -> 0xA5`) triggers a hardware full erase,
  including the flash bootloader; the option-bytes dialog warns and requires
  typed confirmation.

## Limitations

If a device has a flash bootloader without a vector table, or a different
bootloader size, verification fails and the tool refuses to write.
