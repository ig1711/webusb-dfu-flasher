# Preparing the update binary

The vendor update files are **encrypted**. The flasher expects a raw
application binary, so decrypt the update file first.

The reverse-engineering work and the decryption script live in:

```
/home/ryo/work/python/huion-fw-rev-eng
```

Relevant files:

- `decrypt.py` — builds a byte-translation dictionary from two known firmware
  files and writes `<name>.decrypted`.
- `compare_fullchip_vs_update.py` — verifies that a full-chip dump matches the
  decrypted update at `0x08004000` (MD5 `3007dbf1e0fd4f7cf6aa16ce9b92b2`).

## Rules

1. On the **Flash application** page, flash only the decrypted application
   binary (`.bin`).
2. Never flash a full-flash dump on that page — it includes the flash
   bootloader and the tool will refuse it. Use the **Full-chip restore** page
   for full dumps.
3. Application binaries are always programmed at `0x08004000`.
4. Take a full-flash backup first (application page requires it once per
   model).
