import { createSignal } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import { t } from '../i18n/context';

export default function FullChipOps(props: { flasher: Flasher }) {
  const [confirmText, setConfirmText] = createSignal('');
  const [reboot, setReboot] = createSignal(true);
  const confirmed = () => confirmText() === 'FULLCHIP';

  function downloadBackup(bytes: Uint8Array): void {
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${props.flasher.verified()?.part.partNumber ?? 'gd32f350'}_flash_backup.bin`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function backup(): Promise<void> {
    const bytes = await props.flasher.readBackup();
    if (bytes) downloadBackup(bytes);
  }

  return (
    <section class="card">
      <h2>{t('flash.title')}</h2>

      <p class="banner error">{t('fullchip.warning')}</p>
      <p class="hint">{t('fullchip.verify_forced')}</p>
      <p class="hint">{t('fullchip.no_backup_note')}</p>

      <label class="check">
        <input
          type="checkbox"
          checked={reboot()}
          onChange={(event) => setReboot(event.currentTarget.checked)}
          disabled={!props.flasher.canModify()}
        />
        {t('flash.reboot')}
      </label>

      <p class="hint">{t('fullchip.confirm_prompt')}</p>
      <input
        type="text"
        placeholder="FULLCHIP"
        value={confirmText()}
        disabled={!props.flasher.canWriteFirmware()}
        onInput={(event) => setConfirmText(event.currentTarget.value)}
      />

      <div class="actions">
        <button
          class="danger"
          disabled={!props.flasher.canWriteFirmware() || !confirmed()}
          onClick={() => {
            void props.flasher.burn({ eraseFirst: true, verify: true, reboot: reboot() });
            setConfirmText('');
          }}
        >
          {t('fullchip.confirm_label')}
        </button>
        <button disabled={!props.flasher.canRead()} onClick={() => void backup()}>
          {t('flash.read_backup')}
        </button>
        <button disabled={!props.flasher.canModify()} onClick={() => void props.flasher.reboot()}>
          {t('flash.reboot_only')}
        </button>
      </div>
    </section>
  );
}
