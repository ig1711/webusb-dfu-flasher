import { Show } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import { APP_BASE } from '../dfu/codes';
import { formatAddress } from '../dfu/validate';
import { t } from '../i18n/context';

export default function FirmwareCard(props: { flasher: Flasher }) {
  let inputRef: HTMLInputElement | undefined;

  return (
    <section class="card">
      <h2>{t('firmware.title')}</h2>

      <input
        ref={(element) => {
          inputRef = element;
        }}
        type="file"
        accept=".bin"
        class="hidden"
        disabled={!props.flasher.canModify()}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) props.flasher.loadFile(file);
          event.currentTarget.value = '';
        }}
      />

      <div class="actions">
        <button onClick={() => inputRef?.click()} disabled={!props.flasher.canModify() || props.flasher.busy()}>
          {t('firmware.choose')}
        </button>
        <Show when={props.flasher.image()}>
          <button onClick={() => props.flasher.clearImage()} disabled={props.flasher.busy()}>
            {t('firmware.clear')}
          </button>
        </Show>
      </div>

      <p class="hint">{t('firmware.hint')}</p>

      <Show when={props.flasher.image()} fallback={<p class="hint">{t('firmware.none')}</p>}>
        {(loaded) => (
          <dl class="info">
            <dt>Source</dt>
            <dd>{props.flasher.fileName() ?? '—'}</dd>
            <dt>Address</dt>
            <dd>{formatAddress(APP_BASE)}</dd>
            <dt>End</dt>
            <dd>{formatAddress(loaded().endAddressExclusive - 1)}</dd>
            <dt>Size</dt>
            <dd>{loaded().totalBytes.toLocaleString()} bytes</dd>
          </dl>
        )}
      </Show>
    </section>
  );
}
