/**
 * Protocol constants for the GD32 DfuSe interface exposed by the device's
 * flash bootloader (the 16 KB user bootloader at 0x08000000).
 *
 * Everything the rest of the app needs to know about "magic numbers" lives
 * here so there is a single place to audit.
 */

/** Only this exact device is supported. */
export const GD32_VENDOR_ID = 0x28e9;
export const GD32_DFU_PRODUCT_ID = 0x0189;

/** Default DfuSe transfer block size, in bytes. */
export const TRANSFER_BLOCK_SIZE = 1024;

/** Timeouts (ms). Kept explicit so the state machine can be reasoned about. */
export const TIMEOUTS = {
  controlTransfer: 5_000,
  stringDescriptor: 1_000,
  downloadStatus: 3_000,
  eraseSector: 10_000,
  idleRecovery: 500,
} as const;

/** USB control-transfer request codes (`bRequest`) for the DFU class. */
export enum DfuRequest {
  Detach = 0,
  Download = 1,
  Upload = 2,
  GetStatus = 3,
  ClearStatus = 4,
  GetState = 5,
  Abort = 6,
}

/** DFU device states (`bState` returned by GETSTATUS). */
export enum DfuState {
  AppIdle = 0,
  AppDetach = 1,
  DfuIdle = 2,
  DfuDownloadSync = 3,
  DfuDownloadBusy = 4,
  DfuDownloadIdle = 5,
  DfuManifestSync = 6,
  DfuManifest = 7,
  DfuManifestWaitReset = 8,
  DfuUploadIdle = 9,
  DfuError = 10,
}

export const DFU_STATE_NAMES: Record<number, string> = {
  [DfuState.AppIdle]: 'appIDLE',
  [DfuState.AppDetach]: 'appDETACH',
  [DfuState.DfuIdle]: 'dfuIDLE',
  [DfuState.DfuDownloadSync]: 'dfuDNLOAD-SYNC',
  [DfuState.DfuDownloadBusy]: 'dfuDNBUSY',
  [DfuState.DfuDownloadIdle]: 'dfuDNLOAD-IDLE',
  [DfuState.DfuManifestSync]: 'dfuMANIFEST-SYNC',
  [DfuState.DfuManifest]: 'dfuMANIFEST',
  [DfuState.DfuManifestWaitReset]: 'dfuMANIFEST-WAIT-RESET',
  [DfuState.DfuUploadIdle]: 'dfuUPLOAD-IDLE',
  [DfuState.DfuError]: 'dfuERROR',
};

/** DFU status codes (`bStatus` returned by GETSTATUS). */
export enum DfuStatusCode {
  Ok = 0,
  ErrTarget = 1,
  ErrFile = 2,
  ErrWrite = 3,
  ErrErase = 4,
  ErrCheckErased = 5,
  ErrProg = 6,
  ErrVerify = 7,
  ErrAddress = 8,
  ErrNotDone = 9,
  ErrFirmware = 10,
  ErrVendor = 11,
  ErrUsbr = 12,
  ErrPor = 13,
  ErrUnknown = 14,
  ErrStalledPacket = 15,
}

export const DFU_STATUS_NAMES: Record<number, string> = {
  [DfuStatusCode.Ok]: 'OK',
  [DfuStatusCode.ErrTarget]: 'errTARGET',
  [DfuStatusCode.ErrFile]: 'errFILE',
  [DfuStatusCode.ErrWrite]: 'errWRITE',
  [DfuStatusCode.ErrErase]: 'errERASE',
  [DfuStatusCode.ErrCheckErased]: 'errCHECK_ERASED',
  [DfuStatusCode.ErrProg]: 'errPROG',
  [DfuStatusCode.ErrVerify]: 'errVERIFY',
  [DfuStatusCode.ErrAddress]: 'errADDRESS',
  [DfuStatusCode.ErrNotDone]: 'errNOTDONE',
  [DfuStatusCode.ErrFirmware]: 'errFIRMWARE',
  [DfuStatusCode.ErrVendor]: 'errVENDOR',
  [DfuStatusCode.ErrUsbr]: 'errUSBR',
  [DfuStatusCode.ErrPor]: 'errPOR',
  [DfuStatusCode.ErrUnknown]: 'errUNKNOWN',
  [DfuStatusCode.ErrStalledPacket]: 'errSTALLEDPKT',
};

/** DfuSe-specific command bytes carried inside a DNLOAD block. */
export enum DfuSeCommand {
  SetAddress = 0x21,
  EraseSector = 0x41,
}

/** USB string descriptor indices used by the flash bootloader's DFU. */
export const STRING_INDEX = {
  mcuId: 3,
} as const;

/** Flash / option-byte layout defaults (GD32F350). */
export const SRAM_BASE = 0x2000_0000;
export const FLASH_BOOTLOADER_BASE = 0x0800_0000;
/** The flash bootloader (user bootloader) stored in the first 16 KB of main flash. */
export const FLASH_BOOTLOADER_SIZE = 0x4000;
export const APP_BASE = FLASH_BOOTLOADER_BASE + FLASH_BOOTLOADER_SIZE; // 0x08004000
export const DEFAULT_FLASH_BASE = FLASH_BOOTLOADER_BASE;
export const DEFAULT_OPTION_BYTE_BASE = 0x1fff_f800;
export const OPTION_BYTE_LENGTH = 16;
