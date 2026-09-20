import { For, Show, createEffect, createMemo, createSignal, onSettled } from 'solid-js';
import type { Hs611Firmware } from '../firmware/catalog';
import { t } from '../i18n/context';

const LIST_ID = 'hs611-fw-list';

/**
 * Searchable single-select combobox. Native `<select>` cannot be filtered, so
 * this is a text input plus a listbox, with click-outside and keyboard support.
 */
export default function FirmwareCombobox(props: {
  items: readonly Hs611Firmware[];
  selected: Hs611Firmware | null;
  disabled: boolean;
  onSelect: (item: Hs611Firmware) => void;
}) {
  let containerRef: HTMLDivElement | undefined;
  const [text, setText] = createSignal('');
  const [open, setOpen] = createSignal(false);
  const [highlight, setHighlight] = createSignal(0);

  const filtered = createMemo(() => {
    const query = text().trim().toLowerCase();
    if (!query) return props.items;
    return props.items.filter((item) =>
      `${item.label} ${item.description}`.toLowerCase().includes(query),
    );
  });

  const activeItem = createMemo(() => {
    const list = filtered();
    if (list.length === 0) return null;
    return list[Math.min(highlight(), list.length - 1)] ?? null;
  });

  const activeId = createMemo(() => {
    const item = activeItem();
    return open() && item ? `hs611-fw-${item.id}` : undefined;
  });

  // Keep the input showing the selection whenever it changes externally.
  createEffect(
    () => props.selected,
    (selected) => {
      setText(selected ? selected.label : '');
    },
  );

  onSettled(() => {
    const handler = (event: PointerEvent) => {
      if (!containerRef) return;
      if (event.target instanceof Node && !containerRef.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  });

  function choose(item: Hs611Firmware): void {
    props.onSelect(item);
    setOpen(false);
    setText(item.label);
  }

  function onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open()) setOpen(true);
        else setHighlight((current) => Math.min(current + 1, filtered().length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlight((current) => Math.max(current - 1, 0));
        break;
      case 'Enter': {
        const item = activeItem();
        if (open() && item) {
          event.preventDefault();
          choose(item);
        }
        break;
      }
      case 'Escape':
        setOpen(false);
        break;
    }
  }

  return (
    <div
      class="combo"
      ref={(element) => {
        containerRef = element;
      }}
    >
      <input
        type="text"
        role="combobox"
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls={LIST_ID}
        aria-autocomplete="list"
        aria-activedescendant={activeId()}
        value={text()}
        disabled={props.disabled}
        placeholder={t('hs611.fw.placeholder')}
        onInput={(event) => {
          setText(event.currentTarget.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        onKeyDown={onKeyDown}
      />
      <span class="combo-caret" aria-hidden="true">
        ▾
      </span>
      <Show when={open()}>
        <ul class="combo-list" id={LIST_ID} role="listbox">
          <For each={filtered()} fallback={<li class="combo-empty">{t('hs611.fw.no_match')}</li>}>
            {(item, index) => (
              <li
                id={`hs611-fw-${item.id}`}
                role="option"
                aria-selected={props.selected?.id === item.id ? 'true' : 'false'}
                class={activeItem()?.id === item.id ? 'active' : ''}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(item);
                }}
                onMouseEnter={() => setHighlight(index())}
              >
                <span class="combo-label">{item.label}</span>
                <span class="combo-desc">{item.description}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
