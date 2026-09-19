import { Show, createSignal } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import { formatAddress } from '../dfu/validate';
import { t } from '../i18n/context';

export default function FullChipCard(props: { flasher: Flasher }) {
  let inputRef: HTMLInputElement | undefined;
  const [armed, setArmed] = createSignal(false);

  const matchLabel = () => {
    switch (props.flasher.bootloaderMatch()) {
      case 'match':
        return t('fullchip.match_ok');
      case 'mismatch':
        return t('fullchip.match_mismatch');
      case 'unavailable':
        return t('fullchip.match_unavailable');
      default:
        return '';
    }
  };

  return (
    <section class="card">
      <h2>{t('fullchip.title')}</h2>
      <p class="hint">{t('fullchip.subtitle')}</p>

      <label class="check">
        <input
          type="checkbox"
          checked={armed()}
          onChange={(event) => setArmed(event.currentTarget.checked)}
          disabled={!props.flasher.canModify()}
        />
        {t('fullchip.toggle')}
      </label>

      <input
        ref={(element) => {
          inputRef = element;
        }}
        type="file"
        accept=".bin"
        class="hidden"
        disabled={!armed() || !props.flasher.canModify()}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) props.flasher.loadFile(file, 'fullchip');
          event.currentTarget.value = '';
        }}
      />

      <div class="actions">
        <button
          onClick={() => inputRef?.click()}
          disabled={!armed() || !props.flasher.canModify() || props.flasher.busy()}
        >
          {t('firmware.choose')}
        </button>
        <Show when={props.flasher.image()}>
          <button onClick={() => props.flasher.clearImage()} disabled={props.flasher.busy()}>
            {t('firmware.clear')}
          </button>
        </Show>
      </div>

      <Show when={props.flasher.image()} fallback={<p class="hint">{t('firmware.none')}</p>}>
        {(loaded) => (
          <dl class="info">
            <dt>Source</dt>
            <dd>{props.flasher.fileName() ?? '—'}</dd>
            <dt>Address</dt>
            <dd>{formatAddress(loaded().startAddress)}</dd>
            <dt>Size</dt>
            <dd>{loaded().totalBytes.toLocaleString()} bytes</dd>
          </dl>
        )}
      </Show>

      <Show when={matchLabel()}>
        <p class={['banner', { warn: props.flasher.bootloaderMatch() !== 'match' }]}>{matchLabel()}</p>
      </Show>
    </section>
  );
}
