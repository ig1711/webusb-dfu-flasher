/**
 * Registers the WebUSB `disconnect` listener for a flasher instance.
 */

import { onSettled } from 'solid-js';
import type { UsbDeviceLike } from '../dfu/usb';
import type { Flasher } from './controller';

export function useUsbHotplug(flasher: Flasher): void {
  onSettled(() => {
    const usb = (navigator as Navigator & { usb?: EventTarget }).usb;
    if (!usb) return;
    const handler = (event: Event) => {
      const device = (event as CustomEvent & { device?: UsbDeviceLike }).device;
      flasher.onDeviceDisconnected(device);
    };
    usb.addEventListener('disconnect', handler);
    return () => usb.removeEventListener('disconnect', handler);
  });
}
