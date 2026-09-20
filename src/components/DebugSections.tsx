import { Show, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Flasher } from '../flasher/controller';
import { t } from '../i18n/context';
import { DEFAULT_GEOMETRY, type FlashGeometry } from '../dfu/validate';
import { APP_BASE } from '../dfu/codes';
import { dumpDescriptors, formatDescriptorDump } from '../debug/dump';
import {
  probeBootloaderProtection,
  readBytesReport,
  readOptionBytesRaw,
  readWindowReport,
} from '../debug/operations';

const PROTECTION_PROBE_ADDRESS = 0x0800_3800;
const FULLCHIP_ADDRESS = 0x0800_0000;

type Risk = 'read-only' | 'risky' | 'destructive';

export default function DebugSections(props: { flasher: Flasher }) {
  const [copied, setCopied] = createSignal<string | null>(null);

  const geometry = (): FlashGeometry => props.flasher.verified()?.geometry ?? DEFAULT_GEOMETRY;
  const connected = () => props.flasher.connection() === 'connected';

  function log(text: string, level: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
    props.flasher.logger.append(text, level);
  }

  function requireDevice(): boolean {
    if (!props.flasher.session.usbDevice) {
      log('Connect the DFU device before running a probe.', 'error');
      return false;
    }
    return true;
  }

  async function copy(id: string, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((current) => (current === id ? null : current)), 1500);
    } catch {
      // Clipboard may be unavailable; the text stays on screen.
    }
  }

  function downloadBackup(bytes: Uint8Array): void {
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${props.flasher.verified()?.part.partNumber ?? 'gd32f350'}_flash_backup.bin`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // --- backup -------------------------------------------------------------

  const [backupNote, setBackupNote] = createSignal<string | null>(null);
  async function backup(): Promise<void> {
    const bytes = await props.flasher.readBackup();
    if (bytes) {
      downloadBackup(bytes);
      setBackupNote(`Saved ${bytes.length.toLocaleString()} bytes to disk.`);
    }
  }

  // --- test 1: descriptors -------------------------------------------------

  const [descriptorReport, setDescriptorReport] = createSignal<string | null>(null);
  async function dumpDescriptorsAction(): Promise<void> {
    const device = props.flasher.session.usbDevice;
    if (!device) {
      log('Connect the DFU device before dumping descriptors.', 'error');
      return;
    }
    const report = await props.flasher.runOperation('Dump USB descriptors', async () =>
      formatDescriptorDump(await dumpDescriptors(device)),
    );
    if (report) {
      setDescriptorReport(report);
      log(report);
    }
  }

  // --- test 2: option bytes ------------------------------------------------

  const [optionBytesReport, setOptionBytesReport] = createSignal<string | null>(null);
  const [currentOptionBytes, setCurrentOptionBytes] = createSignal<Uint8Array | null>(null);
  async function readOptionBytesAction(): Promise<void> {
    if (!requireDevice()) return;
    const geom = geometry();
    const { session } = props.flasher;
    const report = await props.flasher.runOperation('Read option bytes (raw)', () =>
      readOptionBytesRaw(session, geom),
    );
    if (!report) return;
    setOptionBytesReport(report.text);
    setCurrentOptionBytes(report.optionBytes?.raw ?? null);
    log(report.text, report.ok ? 'info' : 'error');
  }

  // --- test 3: bootloader-region protection probe --------------------------

  const [probeArmed, setProbeArmed] = createSignal(false);
  const [probeReport, setProbeReport] = createSignal<string | null>(null);
  async function runProtectionProbe(): Promise<void> {
    if (!requireDevice()) return;
    const geom = geometry();
    const { session } = props.flasher;
    const report = await props.flasher.runOperation('Bootloader protection probe', () =>
      probeBootloaderProtection(session, geom, PROTECTION_PROBE_ADDRESS),
    );
    if (report) {
      setProbeReport(report.text);
      log(report.text, report.changed ? 'error' : 'warn');
    }
  }

  // --- test 5: full-chip read-only probe ----------------------------------

  const [fcSafeReport, setFcSafeReport] = createSignal<string | null>(null);

  async function readFullChipHead(): Promise<void> {
    if (!requireDevice()) return;
    const geom = geometry();
    const { session } = props.flasher;
    const report = await props.flasher.runOperation('Read 0x08000000', () =>
      readBytesReport(session, geom, FULLCHIP_ADDRESS, 16),
    );
    if (report) {
      setFcSafeReport(report.text);
      log(report.text);
    }
  }

  // --- bug 6: layout window -----------------------------------------------

  const [layoutReport, setLayoutReport] = createSignal<string | null>(null);
  async function readLayout(): Promise<void> {
    if (!requireDevice()) return;
    const geom = geometry();
    const { session } = props.flasher;
    const report = await props.flasher.runOperation('Read layout window', () =>
      readWindowReport(session, geom, 0x0800_0000, APP_BASE - 0x0800_0000 + 64, APP_BASE),
    );
    if (report) {
      setLayoutReport(report.text);
      log(report.text, report.ok ? 'info' : 'error');
    }
  }

  return (
    <>
      <section class="card debug-intro">
        <h2>{t('debug.title')}</h2>
        <p class="hint">{t('debug.intro')}</p>
        <ol class="debug-order">
          <li>Run sections 1, 2, 4 and 5 (all read-only) and copy the output.</li>
          <li>Run section 3: it writes a marker into unused bootloader padding, reads it back, and erases it.</li>
          <li>If the marker does not stick, the bootloader slot is protected and 0x08000000 cannot be reprogrammed.</li>
        </ol>
        <p class="banner warn">{t('debug.recovery')}</p>
        <Show when={connected() && !props.flasher.verified()}>
          <p class="banner warn">
            Device verification failed (identification). The DFU session is still open, so the probes below still run -
            use section 1 to capture what the device actually reports.
          </p>
        </Show>
      </section>

      <DebugSection
        id="backup"
        title="0 · Full-flash backup"
        meta="prerequisite / read-only"
        risk="read-only"
        output={null}
        onCopy={copy}
        copied={copied()}
        actions={
          <button
            class="primary"
            disabled={!props.flasher.verified() || props.flasher.busy()}
            onClick={() => void backup()}
          >
            Read full flash &amp; save
          </button>
        }
      >
        <p class="hint">
          Reads the whole 64 KB and downloads it. Do this before the protection probe so the tablet can be restored.
        </p>
        <Show when={backupNote()}>
          <p class="ok">{backupNote()}</p>
        </Show>
      </DebugSection>

      <DebugSection
        id="descriptors"
        title="1 · Descriptor & string dump"
        meta="test 1 · bugs 1 & 5"
        risk="read-only"
        output={descriptorReport()}
        onCopy={copy}
        copied={copied()}
        actions={
          <button disabled={!connected() || props.flasher.busy()} onClick={() => void dumpDescriptorsAction()}>
            {t('debug.run')}
          </button>
        }
      >
        <p class="hint">
          Dumps device, configuration, DFU functional and string descriptors 0-6. Confirms what answers DFU, what
          string 3 (MCU ID) really contains, and that string 5 is the DfuSe <code>@</code> target name rather than a
          lock flag.
        </p>
      </DebugSection>

      <DebugSection
        id="optionbytes"
        title="2 · Option bytes (raw + decode)"
        meta="test 2 · bug 2"
        risk="read-only"
        output={optionBytesReport()}
        onCopy={copy}
        copied={copied()}
        actions={
          <button disabled={!connected() || props.flasher.busy()} onClick={() => void readOptionBytesAction()}>
            {t('debug.run')}
          </button>
        }
      >
        <p class="hint">
          Reads 16 bytes at 0x1FFFF800 and prints the raw bytes, every value/complement pair, the REG16 view of OB_SPC
          and the classification per the GD32F3x0 FMC rule (0xA5 none / 0xCC high / anything else low).
        </p>
        <Show when={currentOptionBytes()}>
          <p class="hint">
            Option bytes are read-only in this tool: the bootloader has no option-byte programming path, so writing them
            requires SWD.
          </p>
        </Show>
      </DebugSection>

      <DebugSection
        id="protection"
        title="3 · Bootloader write-protection probe"
        meta="bug 4 · decisive test"
        risk="risky"
        output={probeReport()}
        onCopy={copy}
        copied={copied()}
        actions={
          <>
            <label class="check">
              <input
                type="checkbox"
                checked={probeArmed()}
                onChange={(event) => setProbeArmed(event.currentTarget.checked)}
              />
              I understand this writes to the bootloader padding page 0x08003800
            </label>
            <button
              disabled={!probeArmed() || !connected() || props.flasher.busy()}
              onClick={() => void runProtectionProbe()}
            >
              Run probe
            </button>
          </>
        }
      >
        <p class="hint">
          Writes an 8-byte marker into the unused <code>0xFF</code> padding at <code>0x08003800</code> (bootloader code
          ends ~<code>0x08003383</code>), reads it back, then erases the page back to <code>0xFF</code>. If the marker
          does not stick, the bootloader region is a silent no-op and full-chip restore cannot work. This only ever
          touches unused padding.
        </p>
      </DebugSection>

      <DebugSection
        id="fullchip"
        title="4 · Full-chip acceptance (read-only)"
        meta="test 5 · bug 4"
        risk="read-only"
        output={fcSafeReport()}
        onCopy={copy}
        copied={copied()}
        actions={
          <button disabled={!connected() || props.flasher.busy()} onClick={() => void readFullChipHead()}>
            Read 16 bytes @ 0x08000000
          </button>
        }
      >
        <p class="hint">
          Reading <code>0x08000000</code> always works (the full 64 KB dump relies on it). Full-chip write/erase is not
          offered: section 3 shows whether the bootloader slot is protected.
        </p>
      </DebugSection>

      <DebugSection
        id="layout"
        title="5 · Layout window read"
        meta="bug 6"
        risk="read-only"
        output={layoutReport()}
        onCopy={copy}
        copied={copied()}
        actions={
          <button disabled={!connected() || props.flasher.busy()} onClick={() => void readLayout()}>
            {t('debug.run')}
          </button>
        }
      >
        <p class="hint">
          Reads exactly <code>0x4040</code> bytes (<code>APP_BASE - 0x08000000 + 64</code>) and prints the first words
          of both vector tables, matching the check in <code>checks.ts</code>.
        </p>
      </DebugSection>
    </>
  );
}

function DebugSection(props: {
  id: string;
  title: string;
  meta: string;
  risk: Risk;
  output: string | null;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
  actions: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section class="card debug-section">
      <div class="row space-between">
        <h2>{props.title}</h2>
        <span class={`debug-badge debug-${props.risk}`}>
          {props.risk === 'read-only' ? t('debug.risk_readonly') : props.risk === 'risky' ? t('debug.risk_risky') : t('debug.risk_destructive')}
        </span>
      </div>
      <p class="debug-meta">{props.meta}</p>
      {props.children}
      <div class="row wrap debug-actions">{props.actions}</div>
      <Show when={props.output}>
        {(text) => (
          <div class="debug-result">
            <div class="row space-between">
              <strong class="debug-result-title">Output</strong>
              <button onClick={() => props.onCopy(props.id, text())}>
                {props.copied === props.id ? t('debug.copied') : t('debug.copy')}
              </button>
            </div>
            <pre class="debug-output">{text()}</pre>
          </div>
        )}
      </Show>
    </section>
  );
}
