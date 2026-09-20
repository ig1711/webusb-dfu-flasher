import { onCleanup } from 'solid-js';
import { createFlasher } from '../flasher/controller';
import { useUsbHotplug } from '../flasher/hotplug';
import TopBar from '../components/TopBar';
import DeviceCard from '../components/DeviceCard';
import FirmwareCard from '../components/FirmwareCard';
import FlashOps from '../components/FlashOps';
import ProgressBar from '../components/ProgressBar';
import LogTerminal from '../components/LogTerminal';

export default function ApplicationPage() {
  const flasher = createFlasher();
  useUsbHotplug(flasher);
  onCleanup(() => {
    void flasher.disconnect();
  });

  return (
    <>
      <TopBar flasher={flasher} />
      <DeviceCard flasher={flasher} />
      <section class="card combined">
        <div class="panes">
          <div class="pane">
            <FirmwareCard flasher={flasher} />
          </div>
          <div class="pane">
            <FlashOps flasher={flasher} />
          </div>
        </div>
        <ProgressBar flasher={flasher} />
      </section>
      <LogTerminal flasher={flasher} />
    </>
  );
}
