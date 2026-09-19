/**
 * Structural WebUSB types.
 *
 * The real `USBDevice` from the browser satisfies these interfaces, but using
 * our own subset keeps the protocol layer testable without a browser and
 * without depending on WebUSB's DOM typings.
 */

import { GD32_DFU_PRODUCT_ID, GD32_VENDOR_ID } from './codes';
import { UnsupportedEnvironmentError } from './errors';

export interface UsbControlSetup {
  requestType: 'standard' | 'class' | 'vendor';
  recipient: 'device' | 'interface' | 'endpoint' | 'other';
  request: number;
  value: number;
  index: number;
}

export interface UsbInTransferResult {
  status: 'ok' | 'stall' | 'babble';
  data?: DataView;
}

export interface UsbOutTransferResult {
  status: 'ok' | 'stall';
  bytesWritten?: number;
}

export interface UsbDeviceLike {
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber?: string;
  readonly opened: boolean;
  readonly configuration: { configurationValue: number } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  controlTransferIn(setup: UsbControlSetup, length: number): Promise<UsbInTransferResult>;
  controlTransferOut(setup: UsbControlSetup, data?: Uint8Array): Promise<UsbOutTransferResult>;
}

export type RequestDeviceFn = (options: {
  filters: { vendorId: number; productId: number }[];
}) => Promise<UsbDeviceLike>;

/** The single filter this tool will ever offer. */
export function deviceFilter(): { vendorId: number; productId: number }[] {
  return [{ vendorId: GD32_VENDOR_ID, productId: GD32_DFU_PRODUCT_ID }];
}

export function isWebUsbSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const candidate = navigator as Navigator & { usb?: { requestDevice?: unknown } };
  return typeof candidate.usb?.requestDevice === 'function';
}

export const defaultRequestDevice: RequestDeviceFn = (options) => {
  if (typeof navigator === 'undefined') {
    throw new UnsupportedEnvironmentError();
  }
  const candidate = navigator as Navigator & {
    usb?: { requestDevice(options: unknown): Promise<UsbDeviceLike> };
  };
  if (!candidate.usb) {
    throw new UnsupportedEnvironmentError();
  }
  return candidate.usb.requestDevice(options);
};
