/**
 * User-facing English strings.
 *
 * Naming note: the USB DFU device is the "flash bootloader" stored in the
 * first 16 KB of main flash at 0x08000000 (it has no ROM-bootloader jump).
 * The application lives at 0x08004000.
 */

export const messages = {
  'app.title': 'GD32F350 WebUSB Flasher',
  'app.subtitle': '16 KB flash bootloader / application at 0x08004000',

  'nav.application': 'Flash application',
  'nav.debug': 'Debug',

  'debug.title': 'Debug & diagnostics',
  'debug.intro':
    'Read-only probes come first. Every section keeps its raw output so it can be copied and compared against the flash dump. The erase/write probe only touches unused padding.',
  'debug.recovery':
    'The DFU device is the 16 KB flash bootloader itself, entered by the PA1 strap (the button), not BOOT0. It has no ROM-bootloader jump and there is no debug probe. The bootloader ignores erase/write of its own 16 KB (the DFU layer still reports success), so 0x08000000 cannot be reprogrammed by this tool.',
  'debug.run': 'Run',
  'debug.copy': 'Copy',
  'debug.copied': 'Copied',
  'debug.risk_readonly': 'Read-only',
  'debug.risk_risky': 'Padding write',
  'debug.risk_destructive': 'Destructive',

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
  'device.verification_failed': 'Verification failed',
  'device.part_number': 'Part number',
  'device.mcu_id': 'MCU ID',
  'device.flash': 'Flash',
  'device.page_size': 'Page size',
  'device.checks': 'Verification',
  'device.rom_bootloader_access': 'DFU bootloader access',
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
  'flash.reboot_only': 'Reboot device',

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

  'setup.warning':
    'Use the tool with caution. I am not responsible for any damage to your hardware.',
  'setup.title': 'Setup notes',
  'setup.linux': 'Linux: add a udev rule granting access to the 28e9:0189 device, then replug.',
  'setup.windows': 'Windows: bind the device to WinUSB (e.g. Zadig), then replug.',
  'setup.browser': 'Browser: Chrome or Edge over HTTPS or localhost. WebUSB is required.',
  'setup.rom_bootloader':
    'DFU entry: the 16 KB flash bootloader runs its own USB DFU. Hold the PA1 strap (the button) and reset to re-enter it; it has no ROM-bootloader jump, so do not erase 0x08000000.',
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
