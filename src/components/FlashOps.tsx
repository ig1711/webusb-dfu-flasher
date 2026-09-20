import { Show, createSignal } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import { t } from '../i18n/context';

export default function FlashOps(props: { flasher: Flasher }) {
  const [eraseFirst, setEraseFirst] = createSignal(true);
  const [verify, setVerify] = createSignal(true);
  const [reboot, setReboot] = createSignal(false);

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

      <Show when={props.flasher.verified() && !props.flasher.dumpSatisfied()}>
        <p class="banner warn">{t('gate.backup_required')}</p>
      </Show>

      <label class="check">
        <input
          type="checkbox"
          checked={eraseFirst()}
          onChange={(event) => setEraseFirst(event.currentTarget.checked)}
          disabled={!props.flasher.canModify()}
        />
        {t('flash.erase_first')}
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={verify()}
          onChange={(event) => setVerify(event.currentTarget.checked)}
          disabled={!props.flasher.canModify()}
        />
        {t('flash.verify')}
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={reboot()}
          onChange={(event) => setReboot(event.currentTarget.checked)}
          disabled={!props.flasher.canModify()}
        />
        {t('flash.reboot')}
      </label>

      <div class="actions">
        <button
          class="primary"
          disabled={!props.flasher.canWriteFirmware()}
          onClick={() =>
            void props.flasher.burn({ eraseFirst: eraseFirst(), verify: verify(), reboot: reboot() })
          }
        >
          {t('flash.burn')}
        </button>
        <button
          class={props.flasher.verified() && !props.flasher.dumpSatisfied() ? 'primary' : ''}
          disabled={!props.flasher.canRead()}
          onClick={() => void backup()}
        >
          {t('flash.read_backup')}
        </button>
        <button disabled={!props.flasher.canModify()} onClick={() => void props.flasher.reboot()}>
          {t('flash.reboot_only')}
        </button>
      </div>

      <Show when={props.flasher.connection() !== 'disconnected' && props.flasher.blockReason()}>
        <p class="banner warn">{props.flasher.blockReason()}</p>
      </Show>
    </section>
  );
}
