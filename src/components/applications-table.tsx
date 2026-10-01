"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STALE_AFTER_DAYS, STATUSES, STATUS_COLORS, STATUS_LABELS, WORK_MODEL_LABELS, type Status } from "@/lib/constants";
import type { ApplicationRow } from "@/lib/follow-up";
import { formatDate, hostname, timeAgo } from "@/lib/format";

type Props = {
  rows: ApplicationRow[];
  onEdit: (a: ApplicationRow) => void;
};

export function ApplicationsTable({ rows, onEdit }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  async function mutate(id: number, init: RequestInit) {
    setBusyId(id);
    const res = await fetch(`/api/applications/${id}`, init);
    if (!res.ok) alert("Não foi possível salvar a alteração.");
    startTransition(() => {
      router.refresh();
      setBusyId(null);
    });
  }

  const changeStatus = (id: number, status: Status) =>
    mutate(id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });

  const remove = (id: number) => {
    setConfirmId(null);
    mutate(id, { method: "DELETE" });
  };

  if (rows.length === 0) {
    return (
      <div className="card px-6 py-16 text-center text-sm text-muted">
        Nenhuma aplicação encontrada. Ajuste os filtros ou adicione uma nova.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted">
            <th className="px-4 py-3">Vaga</th>
            <th className="px-4 py-3">Plataforma</th>
            <th className="px-4 py-3">Local</th>
            <th className="px-4 py-3">Aplicado em</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Follow-up</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            return (
              <tr
                key={a.id}
                className={`border-b border-border last:border-0 hover:bg-background/60 ${busyId === a.id ? "opacity-50" : ""}`}
              >
                <td className="max-w-80 px-4 py-3">
                  <div className="truncate font-medium">
                    {a.role || a.company ? [a.role, a.company].filter(Boolean).join(" · ") : hostname(a.url)}
                  </div>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-accent hover:underline"
                    title={a.url}
                  >
                    {a.url}
                  </a>
                  {(a.salary || a.contactName || a.notes) && (
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                      {a.salary && <span>💰 {a.salary}</span>}
                      {a.contactName && (
                        <span>
                          👤 {a.contactEmail ? <a className="hover:underline" href={`mailto:${a.contactEmail}`}>{a.contactName}</a> : a.contactName}
                        </span>
                      )}
                      {a.notes && <span className="truncate" title={a.notes}>📝 {a.notes}</span>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{a.platform}</td>
                <td className="px-4 py-3">
                  <div>{a.location ?? <span className="text-muted">—</span>}</div>
                  {a.workModel && <div className="text-xs text-muted">{WORK_MODEL_LABELS[a.workModel]}</div>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatDate(a.appliedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[a.status] }} />
                    <select
                      aria-label="Alterar status"
                      className="input h-8 w-36 px-2"
                      value={a.status}
                      disabled={busyId === a.id}
                      onChange={(e) => changeStatus(a.id, e.target.value as Status)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div className="mt-1 text-xs text-muted" title={new Date(a.statusChangedAt).toLocaleString("pt-BR")}>
                    {timeAgo(a.statusChangedAt)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {a.followUpAt ? (
                    <span className={`tabular-nums ${a.followUpDue ? "font-semibold text-amber-600 dark:text-amber-400" : ""}`}>
                      {a.followUpDue && "⏰ "}
                      {formatDate(a.followUpAt)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                  {a.stale && (
                    <div className="mt-1 text-xs text-red-500" title={`Sem mudança de status há ${STALE_AFTER_DAYS}+ dias`}>
                      Parada
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {confirmId === a.id ? (
                    <span className="inline-flex gap-1">
                      <button className="btn h-8 bg-red-600 px-2.5 text-white hover:bg-red-700" onClick={() => remove(a.id)}>
                        Confirmar
                      </button>
                      <button className="btn-ghost h-8 px-2.5" onClick={() => setConfirmId(null)}>
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex gap-1">
                      <button className="btn-ghost h-8 px-2.5" onClick={() => onEdit(a)}>
                        Editar
                      </button>
                      <button className="btn-ghost h-8 px-2.5 text-red-500" onClick={() => setConfirmId(a.id)}>
                        Excluir
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
