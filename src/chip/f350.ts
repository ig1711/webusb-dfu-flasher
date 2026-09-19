/**
 * GD32F350 catalog.
 *
 * The tool intentionally supports only the GD32F350 family with the known
 * 16 KB flash bootloader layout (application at 0x08004000).
 *
 * AUTO-GENERATED FILE; do not edit by hand.
 */

export interface F350Part {
  readonly partNumber: string;
  readonly mcuid: string;
  readonly flashKb: number;
  readonly flashBytes: number;
  readonly pageSize: number;
  readonly sramKb: number;
  readonly sramBytes: number;
}

export const F350_PARTS: Readonly<Record<string, F350Part>> = {
  "5G4G": {
    "partNumber": "GD32F350G4U6",
    "mcuid": "5G4G",
    "flashKb": 16,
    "flashBytes": 16384,
    "pageSize": 1024,
    "sramKb": 4,
    "sramBytes": 4096
  },
  "5G6G": {
    "partNumber": "GD32F350G6U6",
    "mcuid": "5G6G",
    "flashKb": 32,
    "flashBytes": 32768,
    "pageSize": 1024,
    "sramKb": 6,
    "sramBytes": 6144
  },
  "5G8G": {
    "partNumber": "GD32F350G8U6",
    "mcuid": "5G8G",
    "flashKb": 64,
    "flashBytes": 65536,
    "pageSize": 1024,
    "sramKb": 8,
    "sramBytes": 8192
  },
  "5D3G": {
    "partNumber": "GD32F350G8U6",
    "mcuid": "5D3G",
    "flashKb": 64,
    "flashBytes": 65536,
    "pageSize": 1024,
    "sramKb": 8,
    "sramBytes": 8192
  },
  "5K4G": {
    "partNumber": "GD32F350K4U6",
    "mcuid": "5K4G",
    "flashKb": 16,
    "flashBytes": 16384,
    "pageSize": 1024,
    "sramKb": 4,
    "sramBytes": 4096
  },
  "5K6G": {
    "partNumber": "GD32F350K6U6",
    "mcuid": "5K6G",
    "flashKb": 32,
    "flashBytes": 32768,
    "pageSize": 1024,
    "sramKb": 6,
    "sramBytes": 6144
  },
  "5K8G": {
    "partNumber": "GD32F350K8U6",
    "mcuid": "5K8G",
    "flashKb": 64,
    "flashBytes": 65536,
    "pageSize": 1024,
    "sramKb": 8,
    "sramBytes": 8192
  },
  "5C4G": {
    "partNumber": "GD32F350C4T6",
    "mcuid": "5C4G",
    "flashKb": 16,
    "flashBytes": 16384,
    "pageSize": 1024,
    "sramKb": 4,
    "sramBytes": 4096
  },
  "5C6G": {
    "partNumber": "GD32F350C6T6",
    "mcuid": "5C6G",
    "flashKb": 32,
    "flashBytes": 32768,
    "pageSize": 1024,
    "sramKb": 6,
    "sramBytes": 6144
  },
  "5C8G": {
    "partNumber": "GD32F350C8T6",
    "mcuid": "5C8G",
    "flashKb": 64,
    "flashBytes": 65536,
    "pageSize": 1024,
    "sramKb": 8,
    "sramBytes": 8192
  },
  "5CBG": {
    "partNumber": "GD32F350CBT6",
    "mcuid": "5CBG",
    "flashKb": 128,
    "flashBytes": 131072,
    "pageSize": 1024,
    "sramKb": 20,
    "sramBytes": 20480
  },
  "5R4G": {
    "partNumber": "GD32F350R4T6",
    "mcuid": "5R4G",
    "flashKb": 16,
    "flashBytes": 16384,
    "pageSize": 1024,
    "sramKb": 4,
    "sramBytes": 4096
  },
  "5R6G": {
    "partNumber": "GD32F350R6T6",
    "mcuid": "5R6G",
    "flashKb": 32,
    "flashBytes": 32768,
    "pageSize": 1024,
    "sramKb": 6,
    "sramBytes": 6144
  },
  "5R8G": {
    "partNumber": "GD32F350R8T6",
    "mcuid": "5R8G",
    "flashKb": 64,
    "flashBytes": 65536,
    "pageSize": 1024,
    "sramKb": 16,
    "sramBytes": 16384
  },
  "5RBG": {
    "partNumber": "GD32F350RBT6",
    "mcuid": "5RBG",
    "flashKb": 128,
    "flashBytes": 131072,
    "pageSize": 1024,
    "sramKb": 16,
    "sramBytes": 16384
  }
};
