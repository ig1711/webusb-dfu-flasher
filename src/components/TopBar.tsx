import { Show } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import { t } from '../i18n/context';
import SetupNotes from './SetupNotes';
import ThemeChooser from './ThemeChooser';

export default function TopBar(props: {
  flasher: Flasher;
  title?: string;
  subtitle?: string;
  notes?: boolean;
}) {
  const unsupported = () => props.flasher.connection() === 'unsupported';

  return (
    <header class="topbar">
      <div class="topbar-head">
        <div class="topbar-titles">
          <h1>{props.title ?? t('app.title')}</h1>
          <p class="subtitle">{props.subtitle ?? t('app.subtitle')}</p>
        </div>
        <ThemeChooser />
      </div>
      <Show when={unsupported()}>
        <p class="banner error">{t('top.unsupported')}</p>
      </Show>
      <p class="banner error">{t('setup.warning')}</p>
      <Show when={props.notes ?? true}>
        <SetupNotes />
      </Show>
    </header>
  );
}
