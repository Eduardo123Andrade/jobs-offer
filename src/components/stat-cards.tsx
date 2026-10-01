import Link from "next/link";
import type { Stats } from "@/lib/applications";
import { STALE_AFTER_DAYS } from "@/lib/constants";
import { percent } from "@/lib/format";

function Stat({ label, value, hint, href, tone }: { label: string; value: string | number; hint?: string; href?: string; tone?: "warn" | "danger" }) {
  const color = tone === "warn" ? "text-amber-600 dark:text-amber-400" : tone === "danger" ? "text-red-500" : "";
  const body = (
    <>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card p-4 transition-colors hover:border-accent">{body}</Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

export function StatCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <Stat label="Total" value={stats.total} />
      <Stat label="Em andamento" value={stats.open} />
      <Stat label="Taxa de resposta" value={percent(stats.responseRate)} hint="obtiveram retorno" />
      <Stat label="Chegaram à entrevista" value={percent(stats.interviewRate)} />
      <Stat
        label="Follow-ups pendentes"
        value={stats.followUpsDue}
        href="/?followUp=due"
        tone={stats.followUpsDue ? "warn" : undefined}
      />
      <Stat
        label="Paradas"
        value={stats.stale}
        hint={`sem mudança há ${STALE_AFTER_DAYS}+ dias`}
        href="/?followUp=stale"
        tone={stats.stale ? "danger" : undefined}
      />
    </div>
  );
}
