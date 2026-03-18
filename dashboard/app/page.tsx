"use client";

import { EventDock } from "@/components/event-dock";
import { ModeSections } from "@/components/mode-sections";
import { WorkbenchShell } from "@/components/workbench-shell";
import { useEvolvexDashboard } from "@/hooks/use-evolvex-dashboard";

export default function Home() {
  const dashboard = useEvolvexDashboard();

  return (
    <WorkbenchShell
      mode={dashboard.mode}
      modeCards={dashboard.derived.modeCards}
      overview={dashboard.derived.overview}
      definition={dashboard.derived.activeDefinition}
      connected={dashboard.data.connected}
      operatorNotice={dashboard.operatorNotice}
      onDismissNotice={dashboard.dismissNotice}
      onModeChange={dashboard.setMode}
      inspectorSections={dashboard.derived.inspectorSections}
      canvas={<ModeSections dashboard={dashboard} />}
      dock={<EventDock dashboard={dashboard} />}
    />
  );
}
