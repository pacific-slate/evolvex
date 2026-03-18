"use client";

import { EventDock } from "@/components/event-dock";
import { ModeSections } from "@/components/mode-sections";
import { WorkbenchShell } from "@/components/workbench-shell";
import { useEvolvexDashboard } from "@/hooks/use-evolvex-dashboard";

export default function Home() {
  const dashboard = useEvolvexDashboard();

  return (
    <WorkbenchShell
      apiBase={dashboard.runtime.apiBase}
      mode={dashboard.mode}
      modeCards={dashboard.derived.modeCards}
      overview={dashboard.derived.overview}
      definition={dashboard.derived.activeDefinition}
      connected={dashboard.data.connected}
      operatorNotice={dashboard.operatorNotice}
      onDismissNotice={dashboard.dismissNotice}
      onModeChange={dashboard.setMode}
      inspectorSections={dashboard.derived.inspectorSections}
      growthLatest={dashboard.data.growthLatest}
      growthRuns={dashboard.data.growthRuns}
      growthLatestRun={dashboard.data.growthLatestRun}
      growthPromotionQueue={dashboard.data.growthPromotionQueue}
      onVerifyRealityContract={dashboard.actions.verifyRealityContract}
      verifyingRealityContract={dashboard.data.growthContractRunning}
      canvas={<ModeSections dashboard={dashboard} />}
      dock={<EventDock dashboard={dashboard} />}
    />
  );
}
