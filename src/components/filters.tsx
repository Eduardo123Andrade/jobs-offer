"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { STATUSES, STATUS_LABELS, WORK_MODELS, WORK_MODEL_LABELS, type Status } from "@/lib/constants";
import { StatusDot } from "./status-badge";

type Props = { locations: string[]; platforms: string[] };

export function Filters({ locations, platforms }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const selected = new Set((params.get("status") ?? "").split(",").filter(Boolean) as Status[]);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [location, setLocation] = useState(params.get("location") ?? "");

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounce free-text fields so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q || (params.get("location") ?? "") !== location) update({ q, location });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, location]);

  function toggleStatus(s: Status) {
    const next = new Set(selected);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    update({ status: [...next].join(",") || null });
  }

  const hasFilters = params.size > 0;

  return (
    <section className={`card space-y-3 p-4 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const active = selected.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              aria-pressed={active}
              className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors ${
                active ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted hover:text-foreground"
              }`}
            >
              <StatusDot status={s} />
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="f-q">Buscar</label>
          <input id="f-q" className="input" placeholder="Empresa, cargo, notas..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="f-from">Aplicado de</label>
          <input id="f-from" type="date" className="input" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="f-to">até</label>
          <input id="f-to" type="date" className="input" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="f-location">Localização</label>
          <input id="f-location" list="f-location-options" className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          <datalist id="f-location-options">
            {locations.map((l) => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="f-model">Modelo</label>
          <select id="f-model" className="input" value={params.get("workModel") ?? ""} onChange={(e) => update({ workModel: e.target.value })}>
            <option value="">Todos</option>
            {WORK_MODELS.map((m) => <option key={m} value={m}>{WORK_MODEL_LABELS[m]}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <label className="label" htmlFor="f-platform">Plataforma</label>
          <select id="f-platform" className="input" value={params.get("platform") ?? ""} onChange={(e) => update({ platform: e.target.value })}>
            <option value="">Todas</option>
            {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="w-56">
          <label className="label" htmlFor="f-followup">Follow-up</label>
          <select id="f-followup" className="input" value={params.get("followUp") ?? ""} onChange={(e) => update({ followUp: e.target.value })}>
            <option value="">Todos</option>
            <option value="due">Follow-up pendente</option>
            <option value="stale">Paradas (sem atualização)</option>
          </select>
        </div>
        {hasFilters && (
          <button
            type="button"
            className="btn-ghost ml-auto"
            onClick={() => {
              setQ("");
              setLocation("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>
    </section>
  );
}
