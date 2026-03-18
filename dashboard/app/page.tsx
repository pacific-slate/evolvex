"use client";

import { GrowthWorkspace } from "@/components/growth-workspace";
import { useGrowthSession } from "@/hooks/use-growth-session";

export default function Home() {
  const controller = useGrowthSession();

  return <GrowthWorkspace controller={controller} />;
}
