import { createFlasher } from '../flasher/controller';
import { useUsbHotplug } from '../flasher/hotplug';
import TopBar from '../components/TopBar';
import DeviceCard from '../components/DeviceCard';
import FullChipCard from '../components/FullChipCard';
import FullChipOps from '../components/FullChipOps';
import ProgressBar from '../components/ProgressBar';
import LogTerminal from '../components/LogTerminal';

export default function FullChipPage() {
  const flasher = createFlasher({ requireBackup: false });
  useUsbHotplug(flasher);

  return (
    <>
      <TopBar flasher={flasher} />
      <DeviceCard flasher={flasher} />
      <section class="card combined">
        <div class="panes">
          <div class="pane">
            <FullChipCard flasher={flasher} />
          </div>
          <div class="pane">
            <FullChipOps flasher={flasher} />
          </div>
        </div>
        <ProgressBar flasher={flasher} />
      </section>
      <LogTerminal flasher={flasher} />
    </>
  );
}
