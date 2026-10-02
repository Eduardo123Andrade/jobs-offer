import { NextResponse, type NextRequest } from "next/server";
import { getApplication } from "@/lib/applications";
import { notFound, parseId } from "@/lib/api";
import { cvDocument, renderPdf } from "@/lib/cv/pdf";
import { analyzeApplication, getTailoredCv, jobTextOf } from "@/lib/cv/tailor";
import { findFabrications } from "@/lib/cv/validate";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]/tailored-cv/pdf">) {
  const id = parseId((await ctx.params).id);
  const [application, cv] = id ? await Promise.all([getApplication(id), getTailoredCv(id)]) : [null, null];
  if (!application || !cv) return notFound();

  const { cv: source } = await analyzeApplication(application);
  const violations = findFabrications(cv.markdown, source.markdown, source.facts, jobTextOf(application));
  if (violations.length) {
    return NextResponse.json({ error: "CV com informações que não estão no seu CV original. Gere de novo.", violations }, { status: 409 });
  }

  const pdf = await renderPdf(cvDocument(cv.markdown, cv.language));
  const name = cv.markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? "CV";
  const filename = ["CV", name, application.company].filter(Boolean).join(" - ") + ".pdf";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
