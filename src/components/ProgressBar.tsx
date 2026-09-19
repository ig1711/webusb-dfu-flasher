import { Show } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import type { ProgressPhase } from '../dfu/session';
import { formatAddress } from '../dfu/validate';
import { t, type MessageKey } from '../i18n/context';

const PHASE_KEYS: Record<ProgressPhase, MessageKey> = {
  erase: 'progress.erase',
  write: 'progress.write',
  verify: 'progress.verify',
  read: 'progress.read',
};

export default function ProgressBar(props: { flasher: Flasher }) {
  const progress = () => props.flasher.progress();

  return (
    <section class="card progress">
      <div class="row space-between">
        <strong>{props.flasher.operation() ?? t('progress.idle')}</strong>
        <span>{progress() ? `${progress()!.percent}%` : ''}</span>
      </div>
      <div
        class="bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress()?.percent ?? 0}
      >
        <div class="bar-fill" style={{ width: `${progress()?.percent ?? 0}%` }} />
      </div>
      <Show when={progress()}>
        {(update) => (
          <p class="hint">
            {t(PHASE_KEYS[update().phase])} — {update().bytesDone.toLocaleString()} /{' '}
            {update().bytesTotal.toLocaleString()} bytes @ {formatAddress(update().address)}
          </p>
        )}
      </Show>
    </section>
  );
}
