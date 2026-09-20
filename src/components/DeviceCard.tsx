import { For, Show } from 'solid-js';
import type { Flasher } from '../flasher/controller';
import { formatAddress } from '../dfu/validate';
import { t } from '../i18n/context';

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${bytes.toLocaleString()} bytes (${(bytes / 1024).toFixed(0)} KB)` : `${bytes} bytes`;
}

export default function DeviceCard(props: { flasher: Flasher; embedded?: boolean }) {
  const connected = () => props.flasher.connection() === 'connected';

  const securityLabel = () => {
    switch (props.flasher.protection()) {
      case 'none':
        return t('device.security_none');
      case 'low':
        return t('device.security_low');
      case 'high':
        return t('device.security_high');
      case 'invalid':
        return t('device.security_invalid');
      default:
        return '—';
    }
  };

  const accessLabel = () => {
    switch (props.flasher.verified()?.romBootloaderAccess) {
      case 'accessible':
        return t('device.access_accessible');
      case 'blocked':
        return t('device.access_blocked');
      default:
        return t('device.access_unknown');
    }
  };

  const statusLabel = () => {
    if (!connected()) return t('device.disconnected');
    if (props.flasher.verified()) return t('device.connected');
    if (props.flasher.busy()) return t('device.verifying');
    if (props.flasher.checks().some((check) => check.status === 'fail')) {
      return t('device.verification_failed');
    }
    return t('device.verifying');
  };

  return (
    <section class={props.embedded ? 'device' : 'card device'}>
      <Show when={!props.embedded}>
        <h2>{t('device.title')}</h2>
      </Show>

      <div class="row">
        <Show
          when={connected()}
          fallback={
            <button
              class="primary"
              onClick={() => void props.flasher.connectAndVerify()}
              disabled={props.flasher.busy() || props.flasher.connection() === 'unsupported'}
            >
              {props.flasher.connection() === 'connecting' ? t('device.connecting') : t('device.connect_verify')}
            </button>
          }
        >
          <button onClick={() => void props.flasher.disconnect()} disabled={props.flasher.busy()}>
            {t('device.disconnect')}
          </button>
          <button onClick={() => void props.flasher.connectAndVerify()} disabled={props.flasher.busy()}>
            {t('device.reconnect')}
          </button>
        </Show>
        <span class="status">
          {statusLabel()}
        </span>
      </div>

      <Show when={props.flasher.checks().length > 0}>
        <div class="checks">
          <h3>{t('device.checks')}</h3>
          <For each={props.flasher.checks()}>
            {(check) => (
              <p class={`check check-${check.status}`}>
                <span class="check-mark">{check.status === 'pass' ? '✓' : '✕'}</span>
                <strong>{check.label}</strong>
                <span class="check-detail">{check.detail}</span>
              </p>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.flasher.verified()}>
        {(device) => (
          <dl class="info">
            <dt>{t('device.part_number')}</dt>
            <dd>{device().part.partNumber}</dd>
            <dt>{t('device.mcu_id')}</dt>
            <dd>{device().identity.mcuid}</dd>
            <dt>{t('device.flash')}</dt>
            <dd>{formatBytes(device().geometry.flashBytes)}</dd>
            <dt>{t('device.page_size')}</dt>
            <dd>{`${device().geometry.pageSize} bytes`}</dd>
            <dt>{t('device.security')}</dt>
            <dd>{securityLabel()}</dd>
            <dt>{t('device.rom_bootloader_access')}</dt>
            <dd>{accessLabel()}</dd>
            <dt>{t('device.flash_bootloader')}</dt>
            <dd>
              {`${formatAddress(device().layout.flashBootloaderBase)}–${formatAddress(
                device().layout.appBase - 1,
              )} (${device().layout.flashBootloaderBytes / 1024} KB)`}
            </dd>
            <dt>{t('device.app_base')}</dt>
            <dd>{formatAddress(device().layout.appBase)}</dd>
          </dl>
        )}
      </Show>
    </section>
  );
}
