import { onCleanup } from 'solid-js';
import { createFlasher } from '../flasher/controller';
import { useUsbHotplug } from '../flasher/hotplug';
import TopBar from '../components/TopBar';
import DeviceCard from '../components/DeviceCard';
import DebugSections from '../components/DebugSections';
import ProgressBar from '../components/ProgressBar';
import LogTerminal from '../components/LogTerminal';

export default function DebugPage() {
  const flasher = createFlasher({ requireBackup: false });
  useUsbHotplug(flasher);
  // Release the USB interface when leaving the page so another page can claim it.
  onCleanup(() => {
    void flasher.disconnect();
  });

  return (
    <>
      <TopBar flasher={flasher} />
      <DeviceCard flasher={flasher} />
      <DebugSections flasher={flasher} />
      <ProgressBar flasher={flasher} />
      <LogTerminal flasher={flasher} />
    </>
  );
}
