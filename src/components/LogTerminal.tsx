import { For, createEffect, createSignal } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import { t } from '../i18n/context';

export default function LogTerminal(props: { flasher: Flasher }) {
  let containerRef: HTMLDivElement | undefined;
  let tailRef: HTMLDivElement | undefined;
  const [clearMarks, setClearMarks] = createSignal<number[]>([]);

  // Pixel offset of the last output line when the most recent clear happened.
  // The tail spacer is sized from this so the marker can reach the top of the
  // pane while the scrollback above it stays intact.
  let clearBase: number | undefined;

  const entries = () => props.flasher.logger.entries();

  createEffect(
    () => {
      entries();
      clearMarks();
    },
    () => {
      queueMicrotask(() => {
        if (!containerRef || !tailRef) return;
        // Set the spacer height directly and force a reflow so the new
        // scrollHeight is visible immediately, on the very first clear.
        let height = 0;
        if (clearBase !== undefined) {
          const below = Math.max(0, tailRef.offsetTop - clearBase);
          height = Math.max(0, containerRef.clientHeight - below);
        }
        tailRef.style.height = `${height}px`;
        containerRef.scrollTop = containerRef.scrollHeight;
      });
    },
  );

  // ctrl+L style: mark the current line instead of destroying the buffer.
  function screenClear(): void {
    const id = entries().at(-1)?.id ?? 0;
    clearBase = tailRef ? tailRef.offsetTop : 0;
    setClearMarks((marks) => [...marks, id]);
  }

  async function copyLog(): Promise<void> {
    const text = entries()
      .map((entry) => `[${entry.time}] ${entry.level.toUpperCase()}: ${entry.message}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be denied; the log stays visible.
    }
  }

  const cleared = (id: number) => clearMarks().includes(id);

  const clearMarker = () => (
    <div class="log-clear">
      <span>{t('log.cleared')}</span>
    </div>
  );

  return (
    <section class="card">
      <div class="row space-between">
        <h2>{t('log.title')}</h2>
        <div class="row">
          <button onClick={() => void copyLog()}>{t('log.copy')}</button>
          <button onClick={screenClear}>{t('log.clear')}</button>
        </div>
      </div>
      <div
        class="log"
        ref={(element) => {
          containerRef = element;
        }}
      >
        {cleared(0) && clearMarker()}
        <For each={entries()} fallback={<p class="hint">—</p>}>
          {(entry) => (
            <>
              <p class={`log-line log-${entry.level}`}>
                <span class="log-time">[{entry.time}]</span> {entry.message}
              </p>
              {cleared(entry.id) && clearMarker()}
            </>
          )}
        </For>
        <div
          class="log-tail"
          ref={(element) => {
            tailRef = element;
          }}
        />
      </div>
    </section>
  );
}
