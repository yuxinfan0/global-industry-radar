import { DashboardClient } from "@/components/dashboard-client";
import { getRadar } from "@/lib/radar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const radar = await getRadar(null);
  return <DashboardClient initialRadar={radar} />;
}
