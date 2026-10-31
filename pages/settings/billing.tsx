import UpgradePlanContainer from "@/components/billing/upgrade-plan-container";
import AppLayout from "@/components/layouts/app";
import { SettingsHeader } from "@/components/settings/settings-header";

/** Settings > Edition (route kept as /settings/billing for existing links). */
export default function EditionSettings() {
  return (
    <AppLayout>
      <main className="relative mx-2 mb-10 mt-4 space-y-8 overflow-hidden px-1 sm:mx-3 md:mx-5 md:mt-5 lg:mx-7 lg:mt-8 xl:mx-10">
        <SettingsHeader />
        <UpgradePlanContainer />
      </main>
    </AppLayout>
  );
}
