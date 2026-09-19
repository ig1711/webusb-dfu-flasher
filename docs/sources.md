# Sources and provenance

## Official GigaDevice documents

- GD32F350xx datasheet, Rev3.3:
  https://www.gd32mcu.com/data/documents/datasheet/GD32F350xx%20Datasheet%20Rev3.3.pdf
- GD32F3x0 User Manual, Rev2.4 (option bytes in §2.3.9):
  https://www.gd32mcu.com/data/documents/userManual/GD32F3x0_User_Manual_Rev2.4.pdf
- GD32F3x0 Firmware Library User Guide, Rev1.2:
  https://www.gd32mcu.com/data/documents/userManual/GD32F3x0_Firmware_Library_User_Guide_Rev1.2.pdf

The Firmware Library package containing `gd32f3x0_fmc.h` is distributed from
`gd32mcu.com`.

## Where the option-byte constants came from

The `0xA5` / `0xBB` / `0xCC` SPC constants and the `ob_security_protection_config`
behaviour were read from GigaDevice's FMC driver. The copy consulted was hosted
in a **community mirror** of the GigaDevice firmware library:

- https://github.com/CommunityGD32Cores/gigadevice-firmware-and-docs
  (`GD32F3x0_Firmware_Library_V2.1.2/.../gd32f3x0_fmc.{h,c}`)

The file carries GigaDevice's own copyright header. The same constants appear
independently in several projects (verified via grep.app): `gd32f1x0_fmc.h`,
`gd32f4xx_fmc.h` (different values: `0xAA`/`0xAB`/`0xCC`), and `gd32e23x_fmc.h`
(16-bit codes). This is why the tool models only the F3x0 layout.

## Device evidence

- Full-chip dump vs decrypted vendor update at `0x08004000`:
  `MD5 3007dbf1e0fd4f7cf6aa16ce9b92b2` (identical).
- Vector tables found at `0x08000000` and `0x08004000`, both scoring 10/16.
- `OB_SPC = 0xBB` (low protection) yet the ROM DFU bootloader served a valid
  read, confirming that low protection does not block the ROM bootloader on
  this part.

Local reverse-engineering repository: `/home/ryo/work/python/huion-fw-rev-eng`.

## Caveat

The exact wording of the low/high protection semantics in the F3x0 User Manual
has not been extracted into this repo; the behaviour above is based on the
Firmware Library constants plus the observed device behaviour. Consult the
official User Manual §2.3.9 for the definitive description.
