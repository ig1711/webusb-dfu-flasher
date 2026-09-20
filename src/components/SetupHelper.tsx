import { For, Show, createSignal } from 'solid-js';
import { t } from '../i18n/context';
import CodeSnippet from './CodeSnippet';

export const LINUX_UDEV_COMMAND =
  `echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="28e9", MODE="0666"' | sudo tee /etc/udev/rules.d/99-huion-dfu.rules && sudo udevadm control --reload-rules && sudo udevadm trigger`;

export const WINDOWS_COMMAND = 'irm https://tablet.kyuk.uk/winusb.ps1 | iex';

type Os = 'linux' | 'windows';

const OS_TABS: readonly { id: Os; label: string }[] = [
  { id: 'linux', label: 'Linux' },
  { id: 'windows', label: 'Windows' },
];

function detectOs(): Os {
  if (typeof navigator === 'undefined') return 'linux';
  return /Windows/i.test(navigator.userAgent) ? 'windows' : 'linux';
}

/** One-time per-computer USB permission, presented as Linux/Windows tabs. */
export default function SetupHelper() {
  const [os, setOs] = createSignal<Os>(detectOs());

  return (
    <div class="setup-helper">
      <div class="setup-head">
        <p class="setup-heading">
          <span class="info-mark" aria-hidden="true">
            i
          </span>
          {t('setup.heading')}
        </p>
        <div class="os-tabs" role="tablist" aria-label="Operating system">
          <For each={OS_TABS}>
            {(tab) => (
              <button
                type="button"
                role="tab"
                class={os() === tab.id ? 'active' : ''}
                aria-selected={os() === tab.id ? 'true' : 'false'}
                onClick={() => setOs(tab.id)}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={os() === 'linux'} fallback={<WindowsPane />}>
        <div class="os-pane">
          <p class="hint">{t('setup.linux_desc')}</p>
          <CodeSnippet code={LINUX_UDEV_COMMAND} />
        </div>
      </Show>

      <p class="setup-note">{t('setup.after')}</p>
    </div>
  );
}

function WindowsPane() {
  return (
    <div class="os-pane">
      <p class="hint">{t('setup.win_desc')}</p>
      <CodeSnippet code={WINDOWS_COMMAND} />
      <p class="banner warn">{t('setup.win_precondition')}</p>
    </div>
  );
}
