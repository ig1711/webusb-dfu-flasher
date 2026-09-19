import { For, Show, createEffect, createSignal } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import { SPC_LOW, SPC_NONE } from '../dfu/optionBytes';
import { t } from '../i18n/context';

export interface OptionBytesDialogProps {
  open: boolean;
  flasher: Flasher;
  onClose: () => void;
}

function formatByte(value: number): string {
  return `0x${(value & 0xff).toString(16).toUpperCase().padStart(2, '0')}`;
}

function parseByte(text: string, fallback: number): number {
  const parsed = Number.parseInt(text.trim(), 16);
  if (Number.isNaN(parsed)) return fallback;
  return parsed & 0xff;
}

export default function OptionBytesDialog(props: OptionBytesDialogProps) {
  const [spc, setSpc] = createSignal(SPC_NONE);
  const [user, setUser] = createSignal(0xff);
  const [data0, setData0] = createSignal('0xFF');
  const [data1, setData1] = createSignal('0xFF');
  const [wp0, setWp0] = createSignal('0xFF');
  const [wp1, setWp1] = createSignal('0xFF');
  const [confirmText, setConfirmText] = createSignal('');

  createEffect(
    () => (props.open ? props.flasher.optionBytes() : null),
    (values) => {
      if (!values) return;
      setSpc(values.spc === SPC_LOW ? SPC_LOW : SPC_NONE);
      setUser(values.user);
      setData0(formatByte(values.data0));
      setData1(formatByte(values.data1));
      setWp0(formatByte(values.wp0));
      setWp1(formatByte(values.wp1));
      setConfirmText('');
    },
  );

  const currentLevel = () => props.flasher.optionBytes()?.level ?? 'none';
  const unlocking = () => currentLevel() !== 'none' && spc() === SPC_NONE;
  const locking = () => currentLevel() === 'none' && spc() !== SPC_NONE;
  const confirmationWord = () => (unlocking() ? 'UNLOCK' : locking() ? 'LOCK' : '');
  const confirmed = () => confirmationWord() === '' || confirmText() === confirmationWord();

  const toggleBit = (bit: number, on: boolean) => {
    setUser((current) => (on ? current | (1 << bit) : current & ~(1 << bit)));
  };

  function save(): void {
    void props.flasher.saveOptionBytes({
      spc: spc(),
      user: user() & 0x77,
      data0: parseByte(data0(), 0xff),
      data1: parseByte(data1(), 0xff),
      wp0: parseByte(wp0(), 0xff),
      wp1: parseByte(wp1(), 0xff),
    });
    props.onClose();
  }

  return (
    <Show when={props.open}>
      <div class="modal-backdrop">
        <div class="modal wide">
          <h3>{t('option_bytes.title')}</h3>

          <label class="field">
            <span>{t('option_bytes.spc')}</span>
            <select value={`0x${spc().toString(16).toUpperCase().padStart(2, '0')}`} onChange={(event) => setSpc(parseByte(event.currentTarget.value, spc()))}>
              <option value="0xA5">{t('option_bytes.spc_none')}</option>
              <option value="0xBB">{t('option_bytes.spc_low')}</option>
            </select>
          </label>

          <fieldset class="fieldset">
            <legend>{t('option_bytes.user')}</legend>
            <label>
              <input type="checkbox" checked={(user() & 0x01) !== 0} onChange={(e) => toggleBit(0, e.currentTarget.checked)} />
              {t('option_bytes.user_wdg')}
            </label>
            <label>
              <input type="checkbox" checked={(user() & 0x02) !== 0} onChange={(e) => toggleBit(1, e.currentTarget.checked)} />
              {t('option_bytes.user_stop')}
            </label>
            <label>
              <input type="checkbox" checked={(user() & 0x04) !== 0} onChange={(e) => toggleBit(2, e.currentTarget.checked)} />
              {t('option_bytes.user_standby')}
            </label>
          </fieldset>

          <div class="grid-4">
            <label class="field">
              <span>{t('option_bytes.data0')}</span>
              <input type="text" value={data0()} onInput={(e) => setData0(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span>{t('option_bytes.data1')}</span>
              <input type="text" value={data1()} onInput={(e) => setData1(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span>{t('option_bytes.wp0')}</span>
              <input type="text" value={wp0()} onInput={(e) => setWp0(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span>{t('option_bytes.wp1')}</span>
              <input type="text" value={wp1()} onInput={(e) => setWp1(e.currentTarget.value)} />
            </label>
          </div>

          <Show when={props.flasher.optionBytes()}>
            {(values) => (
              <details class="raw">
                <summary>{t('option_bytes.raw')}</summary>
                <code class="raw-bytes">
                  <For each={[...values().raw]}>
                    {(byte, index) => <span>{`0x${byte.toString(16).toUpperCase().padStart(2, '0')}${index() < values().raw.length - 1 ? ' ' : ''}`}</span>}
                  </For>
                </code>
                <p class="hint">
                  {values().allComplementsValid ? 'Complements valid.' : 'Inconsistent complement detected.'}
                </p>
              </details>
            )}
          </Show>

          <Show when={unlocking()}>
            <p class="banner error">{t('option_bytes.erase_warning')}</p>
          </Show>
          <Show when={locking()}>
            <p class="banner warn">Enabling protection will restrict debug access.</p>
          </Show>
          <Show when={confirmationWord() !== ''}>
            <input
              type="text"
              placeholder={confirmationWord()}
              value={confirmText()}
              onInput={(e) => setConfirmText(e.currentTarget.value)}
            />
          </Show>

          <div class="row end">
            <button onClick={() => props.onClose()}>{t('confirm.cancel')}</button>
            <button class="danger" disabled={!confirmed() || props.flasher.busy()} onClick={save}>
              {t('option_bytes.save')}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
