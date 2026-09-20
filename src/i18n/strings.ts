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
  'nav.hs611': 'Huion HS611',
  'nav.debug': 'Debug',

  'hs611.title': 'Huion HS611 Firmware Flasher',
  'hs611.subtitle': 'Flash a patched application to the Huion HS611 (GD32F350R8T6).',

  'hs611.step.setup': 'Set up your computer',
  'hs611.step.setup_hint': 'One-time USB permission so the browser can reach the tablet.',
  'hs611.step.setup_next': 'Setup complete — continue',

  'hs611.step.dfu': 'Enter DFU mode',
  'hs611.step.dfu_hint': 'Put the HS611 into its firmware update mode.',
  'hs611.step.dfu_next': 'Entered DFU mode — continue',

  'hs611.step.connect': 'Connect & verify',
  'hs611.step.connect_hint': 'Confirm the tablet and its flash layout are supported.',

  'hs611.step.backup': 'Back up your tablet',
  'hs611.step.backup_hint': 'Save a full copy of the current flash before changing anything.',

  'hs611.step.choose': 'Choose firmware',
  'hs611.step.choose_hint': 'Pick the build to write to the tablet.',

  'hs611.step.flash': 'Flash',
  'hs611.step.flash_hint': 'Write the firmware, verify it, and reboot.',

  'setup.heading': 'Enable browser access to the tablet',
  'setup.linux_desc':
    'Add a udev rule so Chrome or Edge can open the tablet without root access:',
  'setup.win_desc':
    'In an Administrator PowerShell window, run the following to associate the WinUSB driver with the tablet:',
  'setup.win_precondition':
    'The tablet has to be in DFU mode while this runs. If it is not, complete Step 1 first, then run the command again.',
  'setup.after': 'Then unplug the tablet and connect it again, this time in DFU mode.',
  'setup.copy': 'Copy command',
  'setup.copied': 'Copied',

  'hs611.dfu.intro':
    'Start with the cable unplugged. Press and hold the top-left express key, then plug the cable back in while you keep holding.',
  'hs611.dfu.gif_alt':
    'Animation showing the top-left express key being held while the USB cable is reconnected to the HS611.',
  'hs611.dfu.note':
    'Hold the key until the computer lists the tablet as a DFU device (about two seconds), then let go.',

  'hs611.backup.desc':
    'This downloads the current flash contents to a file you can keep. Writing stays locked until the backup is done once.',
  'hs611.backup.button': 'Read full flash (backup)',
  'hs611.backup.done': 'Backup saved. You can now write firmware.',

  'hs611.fw.placeholder': 'Search firmware…',
  'hs611.fw.no_match': 'No matching firmware',
  'hs611.fw.desc': 'Select the firmware build to install. The list filters as you type.',
  'hs611.fw.load_error':
    'The selected firmware could not be loaded. See the log below and try again.',

  'hs611.flash.reboot': 'Reboot to firmware when done',
  'hs611.flash.verify_note':
    'The application pages are erased, written, and verified automatically.',
  'hs611.flash.button': 'Write firmware',
  'hs611.flash.writing': 'Writing…',
  'hs611.flash.done': 'Done. The tablet was written, verified, and rebooted.',
  'hs611.flash.again': 'Flash another / start over',
  'hs611.flash.failed': 'The write did not complete. See the log below for the reason.',
  'hs611.flash.no_image': 'Choose a firmware build in the previous step first.',

  'hs611.reconnect_notice': 'The tablet is no longer connected and verified.',
  'hs611.reconnect_action': 'Go back to Connect & verify',

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
