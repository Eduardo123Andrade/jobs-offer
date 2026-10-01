"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Stats } from "@/lib/applications";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";

const axis = { fontSize: 11, fill: "var(--muted)" };
const tooltipStyle = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--foreground)",
  },
  cursor: { fill: "var(--border)", opacity: 0.4 },
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted">{title}</h3>
      <div className="h-56">{children}</div>
    </div>
  );
}

export function Charts({ stats }: { stats: Stats }) {
  const byStatus = stats.byStatus
    .filter((s) => s.count > 0)
    .map((s) => ({ ...s, label: STATUS_LABELS[s.status] }));
  const byWeek = stats.byWeek.map((w) => ({ ...w, label: formatShortDate(w.week) }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="Aplicações por semana">
        <ResponsiveContainer>
          <BarChart data={byWeek} margin={{ left: -24, right: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} labelFormatter={(l) => `Semana de ${l}`} formatter={(v) => [v, "Aplicações"]} />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Por status">
        <ResponsiveContainer>
          <BarChart data={byStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={92} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v, "Aplicações"]} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {byStatus.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Por plataforma">
        <ResponsiveContainer>
          <BarChart data={stats.byPlatform.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="platform" width={92} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v, "Aplicações"]} />
            <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
