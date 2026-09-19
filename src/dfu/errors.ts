/**
 * Error taxonomy for the flasher.
 *
 * Callers should branch on `kind` (or the class) rather than parsing message
 * strings, so user-facing text can change without breaking logic.
 */

import { DFU_STATUS_NAMES, type DfuStatusCode } from './codes';

export type DfuErrorKind =
  | 'unsupported'
  | 'permission'
  | 'transport'
  | 'stall'
  | 'status'
  | 'timeout'
  | 'disconnected'
  | 'validation'
  | 'parse'
  | 'aborted'
  | 'partial-write';

export class DfuError extends Error {
  readonly kind: DfuErrorKind;

  constructor(message: string, kind: DfuErrorKind, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.kind = kind;
  }
}

/** WebUSB is missing (wrong browser) or the page is not a secure context. */
export class UnsupportedEnvironmentError extends DfuError {
  constructor(message = 'WebUSB is not available in this browser or context.') {
    super(message, 'unsupported');
  }
}

/** The selected device is not the supported GD32 DFU device. */
export class WrongDeviceError extends DfuError {
  constructor(message = 'The selected USB device is not a supported GD32 DFU device.') {
    super(message, 'validation');
  }
}

/** A control transfer failed at the transport level. */
export class TransportError extends DfuError {
  constructor(
    message: string,
    readonly transferStatus?: string,
    options?: { cause?: unknown },
  ) {
    super(message, 'transport', options);
  }
}

/** The device stalled the request. */
export class StallError extends DfuError {
  constructor(message = 'The device stalled the USB request.') {
    super(message, 'stall');
  }
}

/** The device reported a non-zero DFU status code. */
export class DfuStatusError extends DfuError {
  readonly code: DfuStatusCode;

  constructor(code: DfuStatusCode, context: string) {
    const name = DFU_STATUS_NAMES[code] ?? `errUNKNOWN(${code})`;
    super(`${context}: device reported ${name}.`, 'status');
    this.code = code;
  }
}

/** A state transition did not complete within its budget. */
export class TimeoutError extends DfuError {
  constructor(message: string) {
    super(message, 'timeout');
  }
}

/** The USB device was removed or the interface was lost. */
export class DisconnectedError extends DfuError {
  constructor(message = 'The USB device was disconnected.') {
    super(message, 'disconnected');
  }
}

/** Input failed validation before any device I/O was attempted. */
export class ValidationError extends DfuError {
  constructor(message: string) {
    super(message, 'validation');
  }
}

/** A firmware file could not be parsed. */
export class FirmwareParseError extends DfuError {
  constructor(
    message: string,
    readonly line?: number,
  ) {
    super(line === undefined ? message : `Line ${line}: ${message}`, 'parse');
  }
}

/** The operation was cancelled by the user. */
export class OperationAbortedError extends DfuError {
  constructor(message = 'Operation cancelled.') {
    super(message, 'aborted');
  }
}

/** Read-back verification found data that differs from what was written. */
export class VerificationError extends DfuError {
  constructor(message: string) {
    super(message, 'status');
  }
}

/**
 * The device was left with a partially written flash region. Callers should
 * surface this prominently: the previous firmware may no longer be bootable.
 */
export class PartialWriteError extends DfuError {
  constructor(
    message: string,
    readonly lastAddress: number,
    readonly bytesWritten: number,
    options?: { cause?: unknown },
  ) {
    super(message, 'partial-write', options);
  }
}

export function isDfuError(error: unknown): error is DfuError {
  return error instanceof DfuError;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof OperationAbortedError || (error instanceof DOMException && error.name === 'AbortError');
}
