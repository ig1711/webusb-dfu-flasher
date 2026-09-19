# GD32F350 WebUSB Flasher

A SolidJS web app that flashes GD32F350-based tablets over WebUSB using the
chip's ROM DFU bootloader. It supports only devices with the known layout: a
16 KB **flash bootloader** in main flash at `0x08000000` and the application at
`0x08004000`.

There are two pages:

- **Flash application** (`/`) — writes a decrypted `.bin` update at
  `0x08004000`. The flash bootloader is never touched; mass erase is not
  implemented.
- **Full-chip restore** (`/fullchip`) — explicitly restores a complete flash
  image (including the flash bootloader) from `0x08000000`, behind a toggle,
  layout checks, a match report and a typed confirmation.

## Usage

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build    # static site in dist/client
pnpm serve    # preview the build
```

Quality checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Flow (application page)

1. Click **Connect & verify**. The tool checks the USB ID, chip model, geometry,
   security protection and flash bootloader layout, stopping at the first
   failure.
2. Click **Read full flash (backup)** once. Writing stays disabled until this is
   done (remembered per model in `localStorage`).
3. Load a decrypted `.bin` update file and click **Write firmware**.

## Safety

- Only `28e9:0189`; non-F350 chips are rejected.
- Protection values other than `0xA5`/`0xBB` (and inconsistent option bytes)
  stop verification before any flash access.
- Application writes are restricted to `0x08004000` and above.
- Full-chip writes require an explicit toggle, exact flash size, layout
  validation, and typing `FULLCHIP`.
- Removing read protection mass-erases the whole flash and requires typed
  confirmation.

## Deployment (Cloudflare Workers)

Deployed as an assets-only Worker (no server code) using Wrangler static assets
with SPA fallback.

`wrangler.jsonc`:

- **assets** `./dist/client` — the `pnpm build` output.
- **`not_found_handling: "single-page-application"`** — serves `index.html` for
  navigation requests such as `/fullchip`, so clean URLs survive refresh and
  direct links.
- **custom domain** `tablet.kyuk.uk` (`custom_domain: true`).

First time (interactive auth):

```bash
pnpm exec wrangler login
```

Build and deploy:

```bash
pnpm deploy        # pnpm build && wrangler deploy
```

Local preview with the real SPA fallback (serves on `http://localhost:8787`):

```bash
pnpm cf:dev
```

Notes:

- The `kyuk.uk` zone must be active in the same Cloudflare account, and
  `tablet.kyuk.uk` must not already have a conflicting CNAME. `wrangler deploy`
  creates the DNS record and certificate for the custom domain.
- WebUSB needs a secure context; `tablet.kyuk.uk` and `*.workers.dev` are HTTPS.
- SPA fallback applies to navigation requests (browser deep links and refresh).
  A non-navigation `fetch('/fullchip')` returns 404, which does not affect this
  app.

See [`docs/`](./docs/README.md) for what each check, field, phase and error
means.
