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
          content="Flash firmware to a GD32 microcontroller over WebUSB using the ROM DFU bootloader."
        />
        <link rel="icon" href="/favicon.ico" />
        <title>{t('app.title')}</title>
        <script>{`try{var p=localStorage.getItem('gd32f350.dfu.palette');if(p)document.documentElement.dataset.palette=p}catch(e){}`}</script>
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
