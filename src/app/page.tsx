import { Suspense } from "react";
import { Charts } from "@/components/charts";
import { ApplicationsSection } from "@/components/dashboard";
import { Filters } from "@/components/filters";
import { StatCards } from "@/components/stat-cards";
import { computeStats, listApplications, listDistinct } from "@/lib/applications";
import { withFlags } from "@/lib/follow-up";
import { parseFilters } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const filters = parseFilters(await searchParams);
  const [rows, locations, platforms] = await Promise.all([
    listApplications(filters),
    listDistinct("location"),
    listDistinct("platform"),
  ]);
  const stats = computeStats(rows);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Minhas aplicações</h1>
        <p className="text-sm text-muted">Acompanhe vagas, status e follow-ups. Métricas refletem os filtros ativos.</p>
      </header>

      <Suspense>
        <Filters locations={locations} platforms={platforms} />
      </Suspense>
      <StatCards stats={stats} />
      <Charts stats={stats} />
      <ApplicationsSection rows={withFlags(rows)} platforms={platforms} locations={locations} />
    </main>
  );
}
