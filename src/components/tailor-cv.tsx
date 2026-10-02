"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CvAnalysis, CvBridge } from "@/db/schema";

type Tailored = {
  html: string;
  markdown: string;
  bridges: CvBridge[];
  changes: string[];
  createdAt: string;
  scoreAfter: number;
  violations: string[];
  reviewWords: string[];
};

type Props = {
  applicationId: number;
  cvPath: string | null;
  hasJobText: boolean;
  analysis: CvAnalysis;
  tailored: Tailored | null;
  scoreBefore: number;
};

export function TailorCv({ applicationId, cvPath, hasJobText, analysis, tailored, scoreBefore }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<{ message: string; violations?: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/tailored-cv`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError({ message: body.error ?? `Erro ${res.status}`, violations: body.violations });
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError({ message: "Falha de conexão com o servidor." });
    } finally {
      setGenerating(false);
    }
  }

  async function copyMarkdown() {
    if (!tailored) return;
    await navigator.clipboard.writeText(tailored.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">Compatibilidade com a vaga (ATS)</h2>
            <p className="text-xs text-muted">
              Comparação de palavras-chave, sem IA. CV base: {analysis.language === "pt" ? "português" : "inglês"}.
            </p>
          </div>
          <div className="flex items-baseline gap-3 text-sm">
            <Score label="CV original" value={scoreBefore} />
            {tailored && (
              <>
                <span className="text-muted">→</span>
                <Score label="CV adaptado" value={tailored.scoreAfter} />
              </>
            )}
          </div>
        </div>

        {analysis.jobTechs.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma tecnologia reconhecida na descrição da vaga.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <Chips label="Você tem" items={analysis.matched} tone="ok" />
            <Chips label="Você tem (está no outro CV, a IA vai incluir)" items={analysis.fromOtherCv} tone="info" />
            <Chips label="Você não tem (não entra no CV)" items={analysis.missing} tone="missing" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button className="btn-primary" onClick={generate} disabled={generating || !hasJobText}>
            {generating ? "Gerando com Gemini…" : tailored ? "Gerar de novo" : "Adaptar CV com IA"}
          </button>
          {tailored && (
            <>
              <a className="btn-ghost" href={`/api/applications/${applicationId}/tailored-cv/pdf`}>
                Baixar PDF
              </a>
              <button className="btn-ghost" onClick={copyMarkdown}>
                {copied ? "Copiado!" : "Copiar markdown"}
              </button>
            </>
          )}
          <span className="text-xs text-muted">
            {!hasJobText
              ? "Adicione a descrição da vaga na aplicação para poder adaptar."
              : generating
                ? "Pode levar de 20s a alguns minutos."
                : tailored
                  ? `Gerado em ${new Date(tailored.createdAt).toLocaleString("pt-BR")}`
                  : ""}
          </span>
          {cvPath && (
            <a className="basis-full text-xs text-muted hover:underline" href={`/api/applications/${applicationId}/cv-file`} target="_blank" rel="noreferrer">
              📄 CV enviado nesta vaga: cv/{cvPath}
            </a>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
            <p className="font-medium text-red-600 dark:text-red-400">{error.message}</p>
            {error.violations && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                {error.violations.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            )}
            {error.violations && <p className="mt-2 text-xs text-muted">Nada foi salvo. Tente gerar de novo.</p>}
          </div>
        )}
      </section>

      {tailored && tailored.bridges.length > 0 && (
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="font-medium">O que você ainda não sabe: como apresentar e estudar</h2>
            <p className="text-xs text-muted">Só para você, para a entrevista e a carta de apresentação. Não entra no CV.</p>
          </div>
          {tailored.bridges.map((b) => (
            <article key={b.tech} className="space-y-1.5 border-t border-border pt-3 first-of-type:border-0 first-of-type:pt-0">
              <h3 className="text-sm font-semibold">
                {b.tech}
                {b.basedOn.length > 0 && <span className="font-normal text-muted"> ← {b.basedOn.join(", ")}</span>}
              </h3>
              <p className="text-sm leading-relaxed">{b.pitch}</p>
              <p className="whitespace-pre-line text-xs leading-relaxed text-muted">{b.studyPlan}</p>
            </article>
          ))}
        </section>
      )}

      {tailored && tailored.violations.length > 0 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p className="font-medium text-red-600 dark:text-red-400">Este CV tem informações que não estão no seu CV original. Gere de novo antes de usar.</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
            {tailored.violations.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      {tailored && tailored.reviewWords.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">Confira antes de enviar</p>
          <p className="mt-1 text-xs text-muted">
            Palavras da vaga que a IA usou e que não aparecem no seu CV. Se não descrevem algo que você fez, edite ou gere de novo.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tailored.reviewWords.map((w) => (
              <span key={w} className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {tailored && (
        <section className="space-y-3">
          {tailored.changes.length > 0 && (
            <details className="card p-4 text-sm">
              <summary className="cursor-pointer font-medium">O que a IA mudou ({tailored.changes.length})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                {tailored.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="cv-preview card bg-white p-8 text-[#1a1a1a]" dangerouslySetInnerHTML={{ __html: tailored.html }} />
        </section>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "text-green-600" : value >= 40 ? "text-amber-600" : "text-red-600";
  return (
    <div className="text-right">
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}%</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

const TONES = {
  ok: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
  info: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  missing: "border-border bg-background text-muted line-through decoration-1",
};

function Chips({ label, items, tone }: { label: string; items: string[]; tone: keyof typeof TONES }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted">{label}:</span>
      {items.map((t) => (
        <span key={t} className={`rounded-full border px-2 py-0.5 text-xs ${TONES[tone]}`}>
          {t}
        </span>
      ))}
    </div>
  );
}
