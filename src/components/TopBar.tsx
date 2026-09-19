import { Show } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import { t } from '../i18n/context';
import SetupNotes from './SetupNotes';
import ThemeChooser from './ThemeChooser';

export default function TopBar(props: { flasher: Flasher }) {
  const unsupported = () => props.flasher.connection() === 'unsupported';

  return (
    <header class="topbar">
      <div class="topbar-head">
        <div class="topbar-titles">
          <h1>{t('app.title')}</h1>
          <p class="subtitle">{t('app.subtitle')}</p>
        </div>
        <ThemeChooser />
      </div>
      <Show when={unsupported()}>
        <p class="banner error">{t('top.unsupported')}</p>
      </Show>
      <SetupNotes />
    </header>
  );
}
