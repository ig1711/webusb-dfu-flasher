& {
    $ErrorActionPreference = 'Stop'
    $Principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()

    if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this command in Administrator PowerShell.'
    }

    if (-not [Environment]::Is64BitProcess) {
        throw 'Use 64-bit PowerShell.'
    }

    $Devices = @(Get-PnpDevice -PresentOnly | Where-Object InstanceId -Like 'USB\VID_28E9&PID_0189\*')
    if ($Devices.Count -ne 1) {
        throw 'Connect exactly one Huion HS611 in DFU mode (28E9:0189), then run this command again.'
    }
    $DeviceId = $Devices[0].InstanceId

    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using FileTime = System.Runtime.InteropServices.ComTypes.FILETIME;

public static class Hs611WinUsbSetup
{
    private const string FlashUpdateInstanceIdPrefix = @"USB\VID_28E9&PID_0189\";
    private const int MaxPathLength = 260;
    private const int MaxLineLength = 256;
    private const uint ClassDriverList = 1; // SPDIT_CLASSDRIVER
    private const uint EnumerateSingleInf = 0x10000; // DI_ENUMSINGLEINF
    private const uint AllowExcludedDrivers = 0x800; // DI_FLAGSEX_ALLOWEXCLUDEDDRVS
    private const uint InheritClassDrivers = 2; // DIOD_INHERIT_CLASSDRVS
    private const uint QuietInstall = 0x800000; // DI_QUIETINSTALL
    private const uint NoFinishInstallUi = 2; // DIIDFLAG_NOFINISHINSTALLUI
    private const int ErrorInsufficientBuffer = 122;
    private const int ErrorNoMoreItems = 259;

    [StructLayout(LayoutKind.Sequential)]
    private struct DeviceInfoData
    {
        public uint Size;
        public Guid ClassGuid;
        public uint DeviceInstance;
        public IntPtr Reserved;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DeviceInstallParameters
    {
        public uint Size;
        public uint Flags;
        public uint FlagsEx;
        public IntPtr ParentWindow;
        public IntPtr InstallMessageHandler;
        public IntPtr InstallMessageHandlerContext;
        public IntPtr FileQueue;
        public UIntPtr ClassInstallReserved;
        public uint Reserved;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxPathLength)]
        public string DriverPath;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DriverInfoData
    {
        public uint Size;
        public uint DriverType;
        public UIntPtr Reserved;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxLineLength)]
        public string Description;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxLineLength)]
        public string Manufacturer;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxLineLength)]
        public string Provider;

        public FileTime DriverDate;
        public ulong DriverVersion;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DriverInfoDetailData
    {
        public uint Size;
        public FileTime DriverDate;
        public uint CompatibleIdsOffset;
        public uint CompatibleIdsLength;
        public UIntPtr Reserved;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxLineLength)]
        public string SectionName;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxPathLength)]
        public string InfPath;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxLineLength)]
        public string Description;

        public ushort FirstHardwareIdCharacter;
    }

    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern IntPtr SetupDiCreateDeviceInfoList(IntPtr classGuid, IntPtr parentWindow);

    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern bool SetupDiDestroyDeviceInfoList(IntPtr deviceInfoSet);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool SetupDiGetDeviceInstallParamsW(
        IntPtr deviceInfoSet, IntPtr deviceInfoData, ref DeviceInstallParameters installParameters);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool SetupDiSetDeviceInstallParamsW(
        IntPtr deviceInfoSet, IntPtr deviceInfoData, ref DeviceInstallParameters installParameters);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool SetupDiGetDeviceInstallParamsW(
        IntPtr deviceInfoSet, ref DeviceInfoData deviceInfoData, ref DeviceInstallParameters installParameters);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool SetupDiSetDeviceInstallParamsW(
        IntPtr deviceInfoSet, ref DeviceInfoData deviceInfoData, ref DeviceInstallParameters installParameters);

    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern bool SetupDiBuildDriverInfoList(IntPtr deviceInfoSet, IntPtr deviceInfoData, uint driverType);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool SetupDiOpenDeviceInfoW(
        IntPtr deviceInfoSet, string deviceInstanceId, IntPtr parentWindow, uint flags, ref DeviceInfoData deviceInfoData);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool SetupDiEnumDriverInfoW(
        IntPtr deviceInfoSet, ref DeviceInfoData deviceInfoData, uint driverType, uint memberIndex, ref DriverInfoData driverInfoData);

    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool SetupDiGetDriverInfoDetailW(
        IntPtr deviceInfoSet, ref DeviceInfoData deviceInfoData, ref DriverInfoData driverInfoData,
        IntPtr driverInfoDetailData, uint driverInfoDetailSize, out uint requiredSize);

    [DllImport("newdev.dll", SetLastError = true)]
    private static extern bool DiInstallDevice(
        IntPtr parentWindow, IntPtr deviceInfoSet, ref DeviceInfoData deviceInfoData,
        ref DriverInfoData driverInfoData, uint flags, out bool rebootRequired);

    public static bool Install(string deviceId)
    {
        if (!deviceId.StartsWith(FlashUpdateInstanceIdPrefix, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Only the Huion HS611 DFU device may be changed.");
        }

        var infPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "INF", "winusb.inf");
        var deviceInfoSet = SetupDiCreateDeviceInfoList(IntPtr.Zero, IntPtr.Zero);
        if (deviceInfoSet == new IntPtr(-1))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Creating device information set failed");
        }

        try
        {
            var installParameters = new DeviceInstallParameters
            {
                Size = (uint)Marshal.SizeOf(typeof(DeviceInstallParameters))
            };
            if (!SetupDiGetDeviceInstallParamsW(deviceInfoSet, IntPtr.Zero, ref installParameters))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Reading global install parameters failed");
            }

            installParameters.DriverPath = infPath;
            installParameters.Flags |= EnumerateSingleInf;
            installParameters.FlagsEx |= AllowExcludedDrivers;
            if (!SetupDiSetDeviceInstallParamsW(deviceInfoSet, IntPtr.Zero, ref installParameters))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Setting inbox driver source failed");
            }

            if (!SetupDiBuildDriverInfoList(deviceInfoSet, IntPtr.Zero, ClassDriverList))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Building inbox class-driver list failed");
            }

            var deviceInfoData = new DeviceInfoData
            {
                Size = (uint)Marshal.SizeOf(typeof(DeviceInfoData))
            };
            if (!SetupDiOpenDeviceInfoW(deviceInfoSet, deviceId, IntPtr.Zero, InheritClassDrivers, ref deviceInfoData))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Opening the HS611 DFU device with DIOD_INHERIT_CLASSDRVS failed");
            }

            var selectedDriver = new DriverInfoData();
            var matchingDriverCount = 0;
            for (uint driverIndex = 0; ; driverIndex++)
            {
                var driverInfoData = new DriverInfoData
                {
                    Size = (uint)Marshal.SizeOf(typeof(DriverInfoData))
                };
                if (!SetupDiEnumDriverInfoW(deviceInfoSet, ref deviceInfoData, ClassDriverList, driverIndex, ref driverInfoData))
                {
                    var errorCode = Marshal.GetLastWin32Error();
                    if (errorCode == ErrorNoMoreItems)
                    {
                        break;
                    }

                    throw new Win32Exception(errorCode, "Enumerating drivers failed");
                }

                DriverInfoDetailData driverDetail = GetDriverInfoDetail(deviceInfoSet, ref deviceInfoData, ref driverInfoData);
                if (string.Equals(driverDetail.SectionName, "WINUSB", StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(driverDetail.InfPath, infPath, StringComparison.OrdinalIgnoreCase))
                {
                    selectedDriver = driverInfoData;
                    matchingDriverCount++;
                }
            }

            if (matchingDriverCount != 1)
            {
                throw new InvalidOperationException("Expected one WINUSB driver.");
            }

            installParameters = new DeviceInstallParameters
            {
                Size = (uint)Marshal.SizeOf(typeof(DeviceInstallParameters))
            };
            if (!SetupDiGetDeviceInstallParamsW(deviceInfoSet, ref deviceInfoData, ref installParameters))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Reading device install parameters failed");
            }

            installParameters.Flags |= QuietInstall;
            if (!SetupDiSetDeviceInstallParamsW(deviceInfoSet, ref deviceInfoData, ref installParameters))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Disabling installer UI failed");
            }

            bool rebootRequired;
            if (!DiInstallDevice(IntPtr.Zero, deviceInfoSet, ref deviceInfoData, ref selectedDriver, NoFinishInstallUi, out rebootRequired))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Installing WinUSB failed");
            }

            return rebootRequired;
        }
        finally
        {
            SetupDiDestroyDeviceInfoList(deviceInfoSet);
        }
    }

    private static DriverInfoDetailData GetDriverInfoDetail(
        IntPtr deviceInfoSet, ref DeviceInfoData deviceInfoData, ref DriverInfoData driverInfoData)
    {
        uint requiredSize;
        var complete = SetupDiGetDriverInfoDetailW(
            deviceInfoSet, ref deviceInfoData, ref driverInfoData, IntPtr.Zero, 0, out requiredSize);
        var errorCode = Marshal.GetLastWin32Error();
        if (!complete && errorCode != ErrorInsufficientBuffer)
        {
            throw new Win32Exception(errorCode, "Reading driver detail size failed");
        }

        var headerSize = Marshal.SizeOf(typeof(DriverInfoDetailData));
        var bufferSize = Math.Max(requiredSize, (uint)headerSize);
        var buffer = Marshal.AllocHGlobal(checked((int)bufferSize));
        try
        {
            Marshal.WriteInt32(buffer, headerSize);
            if (!SetupDiGetDriverInfoDetailW(deviceInfoSet, ref deviceInfoData, ref driverInfoData, buffer, bufferSize, out requiredSize))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Reading driver details failed");
            }

            return (DriverInfoDetailData)Marshal.PtrToStructure(buffer, typeof(DriverInfoDetailData));
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }
}
'@

    $ParametersPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$DeviceId\Device Parameters"
    $ExistingGuids = (Get-ItemProperty -LiteralPath $ParametersPath -ErrorAction SilentlyContinue).DeviceInterfaceGUIDs
    $InterfaceGuids = @(@($ExistingGuids) + '{5E4942A0-C85B-4F7B-B60A-818699215379}' |
        Where-Object { $_ } | Select-Object -Unique)
    New-Item -Path $ParametersPath -Force | Out-Null
    New-ItemProperty -LiteralPath $ParametersPath -Name DeviceInterfaceGUIDs -PropertyType MultiString -Value $InterfaceGuids -Force | Out-Null

    $RebootRequired = [Hs611WinUsbSetup]::Install($DeviceId)
    if ($RebootRequired) {
        Write-Warning 'Restart Windows to finish installing WinUSB.'
    } else {
        $Service = (Get-PnpDeviceProperty -InstanceId $DeviceId -KeyName DEVPKEY_Device_Service).Data
        $Problem = (Get-PnpDeviceProperty -InstanceId $DeviceId -KeyName DEVPKEY_Device_ProblemCode).Data

        if ($Service -ne 'WinUSB' -or $Problem -ne 0) {
            throw 'WinUSB is not ready. Reconnect the tablet and check Device Manager.'
        }

        Write-Output 'WinUSB associated.'
    }
}
