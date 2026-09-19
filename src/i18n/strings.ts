/**
 * User-facing English strings.
 *
 * Naming note: there are two bootloaders. "ROM DFU bootloader" is in system
 * memory outside main flash (the USB device we talk to). "Flash bootloader" is
 * the user bootloader stored in the first 16 KB of main flash.
 */

export const messages = {
  'app.title': 'GD32F350 WebUSB Flasher',
  'app.subtitle': '16 KB flash bootloader / application at 0x08004000',

  'nav.application': 'Flash application',
  'nav.fullchip': 'Full-chip restore',

  'top.unsupported': 'WebUSB is unavailable. Use Chrome/Edge on a secure (HTTPS or localhost) origin.',
  'top.setup': 'Setup notes',

  'device.title': 'Device',
  'device.connect_verify': 'Connect & verify',
  'device.reconnect': 'Reconnect',
  'device.disconnect': 'Disconnect',
  'device.connecting': 'Connecting…',
  'device.verifying': 'Verifying…',
  'device.connected': 'Connected',
  'device.disconnected': 'Not connected',
  'device.part_number': 'Part number',
  'device.mcu_id': 'MCU ID',
  'device.flash': 'Flash',
  'device.page_size': 'Page size',
  'device.checks': 'Verification',
  'device.rom_bootloader_access': 'ROM DFU bootloader access',
  'device.flash_bootloader': 'Flash bootloader (protected)',
  'device.access_accessible': 'Accessible',
  'device.access_blocked': 'Blocked',
  'device.access_unknown': 'Unknown',
  'device.security': 'Security protection',
  'device.security_none': 'None (0xA5)',
  'device.security_low': 'Low (0xBB)',
  'device.security_high': 'High (0xCC)',
  'device.security_invalid': 'Invalid',
  'device.app_base': 'Application base',

  'firmware.title': 'Firmware',
  'firmware.choose': 'Choose a .bin update file',
  'firmware.hint':
    'Only the application binary is written, always at 0x08004000. The flash bootloader is never touched.',
  'firmware.loaded': 'Loaded {name} ({bytes} bytes)',
  'firmware.none': 'No firmware loaded',
  'firmware.clear': 'Clear',

  'flash.title': 'Flash operations',
  'flash.erase_first': 'Erase application pages before writing',
  'flash.verify': 'Verify after writing',
  'flash.reboot': 'Reboot to firmware when done',
  'flash.burn': 'Write firmware',
  'flash.read_backup': 'Read full flash (backup)',
  'flash.option_bytes': 'Option bytes…',
  'flash.reboot_only': 'Reboot device',

  'fullchip.title': 'Full-chip restore',
  'fullchip.subtitle':
    'Restore a complete flash image, including the 16 KB flash bootloader, from 0x08000000.',
  'fullchip.toggle': 'This file is a full-chip backup (includes the flash bootloader)',
  'fullchip.warning':
    'Writing a full-chip image overwrites the flash bootloader. If it is wrong or the write is interrupted, the device will not boot and can only be recovered over the ROM DFU bootloader by driving BOOT0.',
  'fullchip.match_ok': 'The file flash bootloader matches the device.',
  'fullchip.match_mismatch':
    'Warning: the file flash bootloader does NOT match the device. Restoring may change boot behaviour.',
  'fullchip.match_unavailable':
    'Warning: the device flash bootloader could not be compared; proceeding is at your own risk.',
  'fullchip.verify_forced': 'Verification is always performed for full-chip writes.',
  'fullchip.no_backup_note': 'No backup is required on this page.',
  'fullchip.confirm_label': 'Restore full chip',
  'fullchip.confirm_prompt': 'Type FULLCHIP to confirm overwriting the flash bootloader.',

  'gate.backup_first': 'Create a full flash backup before modifying anything.',
  'gate.backup_required': 'Read full flash once to enable writing.',
  'gate.backup_done': 'Backup requirement satisfied.',

  'progress.idle': 'Idle',
  'progress.erase': 'Erasing',
  'progress.write': 'Writing',
  'progress.verify': 'Verifying',
  'progress.read': 'Reading',

  'log.title': 'Log',
  'log.clear': 'Clear',
  'log.copy': 'Copy',
  'log.cleared': 'screen cleared — scroll up for history',

  'confirm.title': 'Confirm',
  'confirm.cancel': 'Cancel',

  'option_bytes.title': 'Option bytes (0x1FFFF800)',
  'option_bytes.spc': 'Security protection (SPC)',
  'option_bytes.spc_none': '0xA5 — none',
  'option_bytes.spc_low': '0xBB — low',
  'option_bytes.user': 'USER flags',
  'option_bytes.user_wdg': 'Independent watchdog',
  'option_bytes.user_stop': 'Reset on stop mode',
  'option_bytes.user_standby': 'Reset on standby mode',
  'option_bytes.data0': 'DATA0',
  'option_bytes.data1': 'DATA1',
  'option_bytes.wp0': 'WP0',
  'option_bytes.wp1': 'WP1',
  'option_bytes.raw': 'Raw option bytes',
  'option_bytes.save': 'Save',
  'option_bytes.loaded': 'Option bytes loaded.',
  'option_bytes.saved': 'Option bytes written. Power-cycle may be required.',
  'option_bytes.erase_warning':
    'This removes read protection and erases the whole flash, including the flash bootloader.',
  'option_bytes.high_refused': 'High protection is not supported.',

  'setup.title': 'Setup notes',
  'setup.linux': 'Linux: add a udev rule granting access to the 28e9:0189 device, then replug.',
  'setup.windows': 'Windows: bind the device to WinUSB (e.g. Zadig), then replug.',
  'setup.browser': 'Browser: Chrome or Edge over HTTPS or localhost. WebUSB is required.',
  'setup.rom_bootloader':
    'ROM DFU bootloader: drive BOOT0 high and reset the board. It lives in system memory, outside main flash.',
  'setup.binary': 'Firmware: use the decrypted application binary only, never a full-flash dump.',

  'error.prefix': 'Error: {message}',
  'error.partial_write': 'Flash was partially written. Retry the write.',
  'error.no_image': 'Load a firmware binary first.',
  'error.protection_high': 'High protection (0xCC) is set; this device is not supported.',
  'error.protection_unknown': 'Security protection could not be determined.',
  'error.busy': 'Another operation is already running.',
} as const;

export type MessageKey = keyof typeof messages;

export function translate(key: MessageKey, params: Record<string, string | number> = {}): string {
  let text: string = messages[key];
  for (const [name, value] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
  }
  return text;
}
