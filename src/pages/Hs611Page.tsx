import { Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { createFlasher } from '../flasher/controller';
import { useUsbHotplug } from '../flasher/hotplug';
import { HS611_FIRMWARES, type Hs611Firmware } from '../firmware/catalog';
import { APP_BASE } from '../dfu/codes';
import { formatAddress } from '../dfu/validate';
import TopBar from '../components/TopBar';
import TutorialStep, { type StepState } from '../components/TutorialStep';
import SetupHelper from '../components/SetupHelper';
import FirmwareCombobox from '../components/FirmwareCombobox';
import DeviceCard from '../components/DeviceCard';
import ProgressBar from '../components/ProgressBar';
import LogTerminal from '../components/LogTerminal';
import { t } from '../i18n/context';

/**
 * Single-tablet guide for the Huion HS611. The steps must be followed in
 * order: each one advances the tutorial and unlocks the next.
 */
export default function Hs611Page() {
  const flasher = createFlasher({
    requireBackup: true,
    requiredMcuid: '5R8G',
    requiredModelLabel: 'Huion HS611 (GD32F350R8T6)',
  });
  useUsbHotplug(flasher);
  onCleanup(() => {
    void flasher.disconnect();
  });

  const [step, setStep] = createSignal(1);
  const [selected, setSelected] = createSignal<Hs611Firmware | null>(null);
  const [loadingFirmware, setLoadingFirmware] = createSignal(false);
  const [reboot, setReboot] = createSignal(true);
  const [flashDone, setFlashDone] = createSignal(false);
  const [flashFailed, setFlashFailed] = createSignal(false);

  // Auto-advance as soon as the corresponding device state is reached.
  createEffect(
    () => flasher.verified(),
    (verified) => {
      if (verified) setStep((current) => Math.max(current, 4));
    },
  );
  createEffect(
    () => flasher.dumpSatisfied(),
    (satisfied) => {
      if (satisfied) setStep((current) => Math.max(current, 5));
    },
  );
  createEffect(
    () => flasher.image(),
    (image) => {
      if (image) setStep((current) => Math.max(current, 6));
    },
  );

  const stepState = (index: number): StepState =>
    index < step() ? 'done' : index === step() ? 'active' : 'upcoming';

  const loadFailed = () => selected() !== null && flasher.image() === null && !loadingFirmware();

  async function chooseFirmware(item: Hs611Firmware): Promise<void> {
    setSelected(item);
    setLoadingFirmware(true);
    await flasher.loadFromUrl(item);
    setLoadingFirmware(false);
  }

  async function backup(): Promise<void> {
    const bytes = await flasher.readBackup();
    if (!bytes) return;
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'HS611_flash_backup.bin';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function flash(): Promise<void> {
    setFlashFailed(false);
    setFlashDone(false);
    const ok = await flasher.burn({ eraseFirst: true, verify: true, reboot: reboot() });
    if (ok) {
      setFlashDone(true);
      setStep(7);
    } else {
      setFlashFailed(true);
    }
  }

  function startOver(): void {
    setFlashDone(false);
    setFlashFailed(false);
    setSelected(null);
    flasher.clearImage();
    setStep(1);
  }

  return (
    <>
      <TopBar
        flasher={flasher}
        title={t('hs611.title')}
        subtitle={t('hs611.subtitle')}
        notes={false}
      />

      <Show when={step() >= 4 && !flasher.verified() && !flashDone()}>
        <p class="banner warn">
          {t('hs611.reconnect_notice')}{' '}
          <button type="button" onClick={() => setStep(3)}>
            {t('hs611.reconnect_action')}
          </button>
        </p>
      </Show>

      <div class="steps">
        <TutorialStep
          index={1}
          title={t('hs611.step.dfu')}
          state={stepState(1)}
          hint={t('hs611.step.dfu_hint')}
        >
          <p class="hint">{t('hs611.dfu.intro')}</p>
          <figure class="dfu-figure">
            <img src="/hs611_dfu_mode_instruction.gif" alt={t('hs611.dfu.gif_alt')} />
          </figure>
          <p class="setup-note">{t('hs611.dfu.note')}</p>
          <div class="step-actions">
            <button type="button" class="primary" onClick={() => setStep((current) => Math.max(current, 2))}>
              {t('hs611.step.dfu_next')}
            </button>
          </div>
        </TutorialStep>

        <TutorialStep
          index={2}
          title={t('hs611.step.setup')}
          state={stepState(2)}
          hint={t('hs611.step.setup_hint')}
        >
          <SetupHelper />
          <div class="step-actions">
            <button type="button" class="primary" onClick={() => setStep((current) => Math.max(current, 3))}>
              {t('hs611.step.setup_next')}
            </button>
          </div>
        </TutorialStep>

        <TutorialStep
          index={3}
          title={t('hs611.step.connect')}
          state={stepState(3)}
          hint={t('hs611.step.connect_hint')}
        >
          <DeviceCard flasher={flasher} embedded />
        </TutorialStep>

        <TutorialStep
          index={4}
          title={t('hs611.step.backup')}
          state={stepState(4)}
          hint={t('hs611.step.backup_hint')}
        >
          <p class="hint">{t('hs611.backup.desc')}</p>
          <Show
            when={flasher.dumpSatisfied()}
            fallback={
              <div class="step-actions">
                <button
                  type="button"
                  class="primary"
                  disabled={!flasher.canRead()}
                  onClick={() => void backup()}
                >
                  {t('hs611.backup.button')}
                </button>
                <span class="status">{flasher.busy() ? (flasher.operation() ?? '') : ''}</span>
              </div>
            }
          >
            <p class="setup-note">{t('hs611.backup.done')}</p>
          </Show>
        </TutorialStep>

        <TutorialStep
          index={5}
          title={t('hs611.step.choose')}
          state={stepState(5)}
          hint={t('hs611.step.choose_hint')}
        >
          <p class="hint">{t('hs611.fw.desc')}</p>
          <FirmwareCombobox
            items={HS611_FIRMWARES}
            selected={selected()}
            disabled={!flasher.canModify()}
            onSelect={(item) => void chooseFirmware(item)}
          />
          <Show when={selected()}>
            {(item) => (
              <dl class="info">
                <dt>Firmware</dt>
                <dd>{item().label}</dd>
                <dt>Details</dt>
                <dd>{item().description}</dd>
                <dt>Address</dt>
                <dd>{formatAddress(APP_BASE)}</dd>
                <dt>Size</dt>
                <dd>{item().bytes.toLocaleString()} bytes</dd>
              </dl>
            )}
          </Show>
          <Show when={loadFailed()}>
            <p class="banner error">{t('hs611.fw.load_error')}</p>
          </Show>
        </TutorialStep>

        <TutorialStep
          index={6}
          title={t('hs611.step.flash')}
          state={stepState(6)}
          hint={t('hs611.step.flash_hint')}
        >
          <Show when={flasher.image()} fallback={<p class="hint">{t('hs611.flash.no_image')}</p>}>
            {(image) => (
              <>
                <dl class="info">
                  <dt>Firmware</dt>
                  <dd>{selected()?.label ?? image().sourceName}</dd>
                  <dt>Address</dt>
                  <dd>{formatAddress(APP_BASE)}</dd>
                  <dt>End</dt>
                  <dd>{formatAddress(image().endAddressExclusive - 1)}</dd>
                  <dt>Size</dt>
                  <dd>{image().totalBytes.toLocaleString()} bytes</dd>
                </dl>

                <label class="check">
                  <input
                    type="checkbox"
                    checked={reboot()}
                    onChange={(event) => setReboot(event.currentTarget.checked)}
                    disabled={flasher.busy()}
                  />
                  {t('hs611.flash.reboot')}
                </label>

                <p class="hint">{t('hs611.flash.verify_note')}</p>

                <Show when={flashFailed()}>
                  <p class="banner error">{t('hs611.flash.failed')}</p>
                </Show>

                <Show
                  when={flashDone()}
                  fallback={
                    <div class="step-actions">
                      <button
                        type="button"
                        class="primary"
                        disabled={!flasher.canWriteFirmware()}
                        onClick={() => void flash()}
                      >
                        {flasher.busy() ? t('hs611.flash.writing') : t('hs611.flash.button')}
                      </button>
                    </div>
                  }
                >
                  <p class="setup-note">{t('hs611.flash.done')}</p>
                  <div class="step-actions">
                    <button type="button" onClick={startOver}>
                      {t('hs611.flash.again')}
                    </button>
                  </div>
                </Show>

                <ProgressBar flasher={flasher} embedded />
              </>
            )}
          </Show>
        </TutorialStep>
      </div>

      <LogTerminal flasher={flasher} />
    </>
  );
}
