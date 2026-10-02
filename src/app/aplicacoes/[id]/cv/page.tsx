import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TailorCv } from "@/components/tailor-cv";
import { parseId } from "@/lib/api";
import { getApplication } from "@/lib/applications";
import { scoreCv } from "@/lib/cv/analyze";
import { cvToHtml } from "@/lib/cv/pdf";
import { analyzeApplication, getTailoredCv, jobTextOf } from "@/lib/cv/tailor";
import { findFabrications, findJobOnlyWords } from "@/lib/cv/validate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "CV adaptado" };

export default async function TailoredCvPage({ params }: PageProps<"/aplicacoes/[id]/cv">) {
  const id = parseId((await params).id);
  const application = id && (await getApplication(id));
  if (!application) notFound();

  const [{ cv, analysis }, tailored] = await Promise.all([analyzeApplication(application), getTailoredCv(application.id)]);
  const hasJobText = Boolean(application.description || application.responsibilities);
  const jobText = jobTextOf(application);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Minhas aplicações
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">CV adaptado para a vaga</h1>
        <p className="text-sm text-muted">
          {[application.role, application.company].filter(Boolean).join(" · ") || application.url}
        </p>
      </header>
      <TailorCv
        applicationId={application.id}
        cvPath={application.cvPath}
        hasJobText={hasJobText}
        analysis={analysis}
        tailored={
          tailored && {
            html: cvToHtml(tailored.markdown),
            markdown: tailored.markdown,
            bridges: tailored.bridges,
            changes: tailored.changes,
            createdAt: tailored.createdAt.toISOString(),
            scoreAfter: scoreCv(tailored.markdown, analysis.jobTechs),
            // Re-checked on every view, so CVs saved before a validator fix still get flagged.
            violations: findFabrications(tailored.markdown, cv.markdown, cv.facts, jobText),
            reviewWords: findJobOnlyWords(tailored.markdown, cv.facts, jobText),
          }
        }
        scoreBefore={scoreCv(cv.markdown, analysis.jobTechs)}
      />
    </main>
  );
}
