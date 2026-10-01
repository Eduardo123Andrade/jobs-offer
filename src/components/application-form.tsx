"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Application } from "@/db/schema";
import {
  PLATFORM_SUGGESTIONS,
  STATUSES,
  STATUS_LABELS,
  WORK_MODELS,
  WORK_MODEL_LABELS,
} from "@/lib/constants";
import { todayIso as today } from "@/lib/follow-up";

type Props = {
  open: boolean;
  onClose: () => void;
  /** When set, the form edits this application; otherwise it creates a new one. */
  application?: Application | null;
  platforms: string[];
  locations: string[];
};

type FieldErrors = Record<string, string[] | undefined>;


export function ApplicationForm({ open, onClose, application, platforms, locations }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setErrors({});
      setFormError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(application ? `/api/applications/${application.id}` : "/api/applications", {
      method: application ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrors(body.fields ?? {});
      setFormError(body.error ?? "Erro ao salvar");
      return;
    }
    startTransition(() => {
      router.refresh();
      onClose();
    });
  }

  const a = application;
  const platformOptions = [...new Set([...PLATFORM_SUGGESTIONS, ...platforms])];
  const err = (name: string) =>
    errors[name]?.length ? <p className="mt-1 text-xs text-red-500">{errors[name]![0]}</p> : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[min(720px,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/50"
    >
      {/* key resets uncontrolled inputs whenever the target application changes */}
      <form key={a?.id ?? "new"} onSubmit={onSubmit} className="flex max-h-[85vh] flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{a ? "Editar aplicação" : "Nova aplicação"}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Fechar">
            ✕
          </button>
        </header>

        <div className="grid gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="url">Link da vaga *</label>
            <input id="url" name="url" type="url" required className="input" placeholder="https://..." defaultValue={a?.url} autoFocus />
            {err("url")}
          </div>

          <div>
            <label className="label" htmlFor="company">Empresa</label>
            <input id="company" name="company" className="input" defaultValue={a?.company ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="role">Cargo</label>
            <input id="role" name="role" className="input" defaultValue={a?.role ?? ""} />
          </div>

          <div>
            <label className="label" htmlFor="platform">Plataforma *</label>
            <input id="platform" name="platform" required list="platform-options" className="input" defaultValue={a?.platform ?? ""} />
            <datalist id="platform-options">
              {platformOptions.map((p) => <option key={p} value={p} />)}
            </datalist>
            {err("platform")}
          </div>
          <div>
            <label className="label" htmlFor="status">Status *</label>
            <select id="status" name="status" className="input" defaultValue={a?.status ?? "applied"}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="appliedAt">Data da aplicação *</label>
            <input id="appliedAt" name="appliedAt" type="date" required className="input" defaultValue={a?.appliedAt ?? today()} />
            {err("appliedAt")}
          </div>
          <div>
            <label className="label" htmlFor="followUpAt">Próximo follow-up</label>
            <input id="followUpAt" name="followUpAt" type="date" className="input" defaultValue={a?.followUpAt ?? ""} />
            {err("followUpAt")}
          </div>

          <div>
            <label className="label" htmlFor="location">Localização</label>
            <input id="location" name="location" list="location-options" className="input" placeholder="São Paulo, SP" defaultValue={a?.location ?? ""} />
            <datalist id="location-options">
              {locations.map((l) => <option key={l} value={l} />)}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="workModel">Modelo de trabalho</label>
            <select id="workModel" name="workModel" className="input" defaultValue={a?.workModel ?? ""}>
              <option value="">—</option>
              {WORK_MODELS.map((m) => <option key={m} value={m}>{WORK_MODEL_LABELS[m]}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="salary">Salário / faixa</label>
            <input id="salary" name="salary" className="input" placeholder="R$ 10.000 – 12.000 CLT" defaultValue={a?.salary ?? ""} />
          </div>

          <div>
            <label className="label" htmlFor="contactName">Contato (recrutador)</label>
            <input id="contactName" name="contactName" className="input" defaultValue={a?.contactName ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="contactEmail">E-mail do contato</label>
            <input id="contactEmail" name="contactEmail" type="email" className="input" defaultValue={a?.contactEmail ?? ""} />
            {err("contactEmail")}
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Notas</label>
            <textarea id="notes" name="notes" rows={4} className="input h-auto py-2" defaultValue={a?.notes ?? ""} />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {formError && <p className="mr-auto text-sm text-red-500">{formError}</p>}
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
