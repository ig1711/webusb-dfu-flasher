/**
 * UI-facing flasher state.
 *
 * Application mode: connect & verify -> required full-flash backup -> write the
 * update binary at 0x08004000. Full-chip restore is deliberately not offered
 * (the flash bootloader ignores erase/write of its own 16 KB; see repo docs).
 */

import { createMemo, createSignal } from 'solid-js';
import { DfuSession, type ProgressUpdate } from '../dfu/session';
import { APP_BASE } from '../dfu/codes';
import { isWritableLevel, type F350OptionBytes } from '../dfu/optionBytes';
import { isDfuError, PartialWriteError } from '../dfu/errors';
import { isWebUsbSupported, type UsbDeviceLike } from '../dfu/usb';
import { createFirmwareImage, type FirmwareImage } from '../firmware/image';
import { runDeviceChecks, type CheckOutcome, type VerifiedDevice } from './checks';
import { t } from '../i18n/context';
import { createLogger } from './log';

export type ConnectionState = 'unsupported' | 'disconnected' | 'connecting' | 'connected';

const STORAGE_KEY = 'gd32f350.dfu.dumpedDevices';

function readDumpedMap(): Record<string, string> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function hasDumped(partNumber: string): boolean {
  return Boolean(readDumpedMap()[partNumber]);
}

function recordDumped(partNumber: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const map = readDumpedMap();
    map[partNumber] = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage may be unavailable; the current session still tracks the dump.
  }
}

export interface FlasherOptions {
  /** Require a full-flash backup once before enabling writes (application page). */
  requireBackup?: boolean;
}

export interface BurnOptions {
  eraseFirst: boolean;
  verify: boolean;
  reboot: boolean;
}

export function createFlasher(options: FlasherOptions = {}) {
  const requireBackup = options.requireBackup ?? true;
  const logger = createLogger();
  const session = new DfuSession({ logger: (message) => logger.append(message) });

  const [connection, setConnection] = createSignal<ConnectionState>(
    isWebUsbSupported() ? 'disconnected' : 'unsupported',
  );
  const [checks, setChecks] = createSignal<CheckOutcome[]>([]);
  const [verified, setVerified] = createSignal<VerifiedDevice | null>(null);
  const [dumpSatisfied, setDumpSatisfied] = createSignal(false);
  const [optionBytes, setOptionBytes] = createSignal<F350OptionBytes | null>(null);
  const [image, setImage] = createSignal<FirmwareImage | null>(null);
  const [fileName, setFileName] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [operation, setOperation] = createSignal<string | null>(null);
  const [progress, setProgress] = createSignal<ProgressUpdate | null>(null);

  let abortController: AbortController | null = null;

  const protection = createMemo(() => optionBytes()?.level ?? null);
  const canRead = createMemo(() => verified() !== null && !busy());
  const backupSatisfied = createMemo(() => !requireBackup || dumpSatisfied());
  const canModify = createMemo(() => canRead() && backupSatisfied());
  const canWriteFirmware = createMemo(() => {
    const level = protection();
    return canModify() && Boolean(image()) && level !== null && isWritableLevel(level);
  });

  const blockReason = createMemo(() => {
    if (connection() !== 'connected') return 'Connect and verify the device first.';
    if (!verified()) return 'Device verification failed; re-run checks.';
    if (!backupSatisfied()) return t('gate.backup_first');
    if (!image()) return t('error.no_image');
    const level = protection();
    if (level === 'high') return t('error.protection_high');
    if (level === 'invalid' || level === null) return t('error.protection_unknown');
    return '';
  });

  async function guarded(label: string, run: () => Promise<void>): Promise<boolean> {
    if (busy()) {
      logger.append(t('error.busy'), 'warn');
      return false;
    }
    setBusy(true);
    setOperation(label);
    setProgress(null);
    try {
      await run();
      return true;
    } catch (error) {
      logger.append(describeError(error), 'error');
      return false;
    } finally {
      setBusy(false);
      setOperation(null);
      setProgress(null);
      abortController = null;
    }
  }

  // --- connect & verify ---------------------------------------------------

  async function connectAndVerify(): Promise<void> {
    if (busy()) return;
    setConnection('connecting');
    setChecks([]);
    setVerified(null);
    setOptionBytes(null);
    setDumpSatisfied(false);

    const opened = await guarded('Connect & verify', async () => {
      await session.open();
      setConnection('connected');
      const device = await runDeviceChecks(session, {
        onOutcome: (outcome) => setChecks((previous) => [...previous, outcome]),
      });
      setVerified(device);
      setOptionBytes(device.optionBytes);
      const known = hasDumped(device.part.partNumber);
      setDumpSatisfied(known);
      logger.append(
        `Verified ${device.part.partNumber}: 16 KB flash bootloader, application at 0x08004000.`,
        'success',
      );
      if (requireBackup) {
        if (known) {
          logger.append('Previous flash backup found for this model; modification is unlocked.');
        } else {
          logger.append(t('gate.backup_required'), 'warn');
        }
      }
    });

    if (!opened && connection() !== 'connected') {
      setConnection('disconnected');
    }
  }

  async function disconnect(): Promise<void> {
    abortController?.abort();
    await session.close();
    setVerified(null);
    setOptionBytes(null);
    setDumpSatisfied(false);
    setChecks([]);
    setConnection(isWebUsbSupported() ? 'disconnected' : 'unsupported');
    logger.append('Disconnected.');
  }

  function onDeviceDisconnected(device: UsbDeviceLike | undefined): void {
    if (device && device !== session.usbDevice) return;
    if (!session.connected) return;
    abortController?.abort();
    logger.append('The USB device was unplugged.', 'warn');
    void disconnect();
  }

  // --- firmware -----------------------------------------------------------

  function loadFile(file: File): void {
    if (!canModify() || !verified()) {
      logger.append(blockReason() || t('gate.backup_first'), 'error');
      return;
    }
    setFileName(file.name);
    void file
      .arrayBuffer()
      .then((buffer) => {
        const loaded = createFirmwareImage(new Uint8Array(buffer), file.name);
        setImage(loaded);
        logger.append(
          t('firmware.loaded', { name: file.name, bytes: loaded.totalBytes }),
          'success',
        );
      })
      .catch((error) => {
        setImage(null);
        logger.append(describeError(error), 'error');
      });
  }

  function clearImage(): void {
    setImage(null);
    setFileName(null);
  }

  // --- backup (required once on the application page) --------------------

  async function readBackup(): Promise<Uint8Array | null> {
    const current = verified();
    if (!current) {
      logger.append(blockReason(), 'error');
      return null;
    }
    let result: Uint8Array | null = null;
    await guarded('Read full flash', async () => {
      const controller = new AbortController();
      abortController = controller;
      result = await session.readFlash(
        current.geometry.flashBase,
        current.geometry.flashBytes,
        current.geometry,
        { onProgress: setProgress, signal: controller.signal },
      );
      recordDumped(current.part.partNumber);
      setDumpSatisfied(true);
      logger.append(`Read ${result.length} byte(s); backup requirement satisfied.`, 'success');
    });
    return result;
  }

  // --- flash operations ---------------------------------------------------

  async function burn(options: BurnOptions): Promise<void> {
    const current = verified();
    const currentImage = image();
    const reason = blockReason();
    if (reason) {
      logger.append(reason, 'error');
      return;
    }
    if (!current || !currentImage) return;

    await guarded('Write firmware', async () => {
      const controller = new AbortController();
      abortController = controller;
      try {
        await session.writeImage(currentImage, current.geometry, {
          eraseFirst: options.eraseFirst,
          onProgress: setProgress,
          signal: controller.signal,
        });
        logger.append('Write complete.', 'success');

        if (options.verify) {
          await session.verifyImage(currentImage, current.geometry, {
            onProgress: setProgress,
            signal: controller.signal,
          });
          logger.append('Verification passed.', 'success');
        }

        if (options.reboot) {
          await session.rebootToApplication(APP_BASE, current.geometry);
          setConnection('disconnected');
          setVerified(null);
          logger.append('Rebooting into the application.');
        }
      } catch (error) {
        if (error instanceof PartialWriteError) logger.append(t('error.partial_write'), 'error');
        throw error;
      }
    });
  }

  async function reboot(): Promise<void> {
    const current = verified();
    if (!current) {
      logger.append(blockReason(), 'error');
      return;
    }
    await guarded('Reboot', async () => {
      await session.rebootToApplication(APP_BASE, current.geometry);
      setConnection('disconnected');
      setVerified(null);
      logger.append('Reboot command sent.');
    });
  }

  function describeError(error: unknown): string {
    if (isDfuError(error)) return error.message;
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Run an arbitrary device operation under the shared busy guard. Used by the
   * debug page so its raw probes cannot race a normal flash operation.
   */
  async function runOperation<T>(label: string, run: () => Promise<T>): Promise<T | undefined> {
    let result: T | undefined;
    const succeeded = await guarded(label, async () => {
      result = await run();
    });
    return succeeded ? result : undefined;
  }

  return {
    logger,
    session,
    connection,
    checks,
    verified,
    dumpSatisfied,
    requiresBackup: requireBackup,
    optionBytes,
    protection,
    image,
    fileName,
    busy,
    operation,
    progress,
    canRead,
    canModify,
    canWriteFirmware,
    blockReason,
    connectAndVerify,
    disconnect,
    onDeviceDisconnected,
    loadFile,
    clearImage,
    readBackup,
    burn,
    reboot,
    runOperation,
  };
}

export type Flasher = ReturnType<typeof createFlasher>;
