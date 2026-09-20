import type { ParentProps } from 'solid-js';
import { HydrationScript } from '@solidjs/web';
import { t } from './i18n/context';

// The document shell (the index.html replacement), picked up by the
// src/Document.* convention; it must render the full <html> and ships no
// client JS. <HydrationScript /> is stripped from the prerendered shell in
// client mode and activates under `ssr: true`.
export default function Document(props: ParentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Flash firmware to a GD32 microcontroller over WebUSB using the flash bootloader's DfuSe interface."
        />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={t('app.title')} />
        <meta
          property="og:description"
          content="Flash firmware to a GD32 microcontroller over WebUSB using the flash bootloader's DfuSe interface."
        />
        <meta property="og:image" content="/icon.svg" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={t('app.title')} />
        <meta
          name="twitter:description"
          content="Flash firmware to a GD32 microcontroller over WebUSB using the flash bootloader's DfuSe interface."
        />
        <meta name="twitter:image" content="/icon.svg" />
        <title>{t('app.title')}</title>
        <script>{`try{var p=localStorage.getItem('gd32f350.dfu.palette');if(p)document.documentElement.dataset.palette=p}catch(e){}`}</script>
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
