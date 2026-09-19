import { For, createSignal, onSettled } from 'solid-js';

export const PALETTES = [
  { id: 'paper', label: 'Paper' },
  { id: 'slate', label: 'Slate' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'amber', label: 'Amber' },
  { id: 'mono', label: 'Mono' },
  { id: 'rose', label: 'Rose' },
] as const;

type PaletteId = (typeof PALETTES)[number]['id'];

const STORAGE_KEY = 'gd32f350.dfu.palette';
const DEFAULT: PaletteId = 'paper';

function isPalette(value: string | null): value is PaletteId {
  return value !== null && PALETTES.some((palette) => palette.id === value);
}

function readStored(): PaletteId | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isPalette(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export default function ThemeChooser() {
  const [palette, setPalette] = createSignal<PaletteId>(DEFAULT);

  const apply = (id: PaletteId): void => {
    setPalette(id);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.palette = id;
    }
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Private mode / storage disabled: the choice just is not persisted.
    }
  };

  onSettled(() => {
    const stored = readStored();
    setPalette(stored ?? DEFAULT);
  });

  return (
    <div class="palette" role="group" aria-label="Color palette">
      <For each={PALETTES}>
        {(item) => (
          <button
            type="button"
            class={palette() === item.id ? 'active' : ''}
            aria-pressed={palette() === item.id ? 'true' : 'false'}
            onClick={() => apply(item.id)}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
}
