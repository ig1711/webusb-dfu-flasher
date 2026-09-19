import { t } from '../i18n/context';

export default function SetupNotes() {
  return (
    <details class="setup">
      <summary>{t('top.setup')}</summary>
      <ul>
        <li>{t('setup.linux')}</li>
        <li>{t('setup.windows')}</li>
        <li>{t('setup.browser')}</li>
        <li>{t('setup.rom_bootloader')}</li>
      </ul>
    </details>
  );
}
