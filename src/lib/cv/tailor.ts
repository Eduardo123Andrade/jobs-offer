import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, tailoredCvs, type Application, type CvBridge } from "@/db/schema";
import { analyzeFit, detectLanguage } from "./analyze";
import { askGemini, parseJsonAnswer } from "./gemini";
import type { CvProgress } from "./progress";
import { cvDocument, renderPdf } from "./pdf";
import { cvHeader, loadCv, saveTailoredPdf, withHeader } from "./source";
import { findBridgeFabrications, findFabrications } from "./validate";

export function jobTextOf(a: Application) {
  return [a.role, a.description, a.responsibilities].filter(Boolean).join("\n\n");
}

/** Deterministic part only (no AI): language + keyword match. Cheap enough to run on every page view. */
export async function analyzeApplication(a: Application) {
  const jobText = jobTextOf(a);
  const cv = await loadCv(detectLanguage(jobText));
  return { cv, analysis: analyzeFit(jobText, a.technologies, cv.markdown, cv.facts, cv.language) };
}

export async function getTailoredCv(applicationId: number) {
  const [row] = await db.select().from(tailoredCvs).where(eq(tailoredCvs.applicationId, applicationId));
  return row ?? null;
}

type AiAnswer = { cv: string; bridges?: CvBridge[]; changes?: string[] };

export class FabricationError extends Error {
  constructor(public violations: string[]) {
    super("A IA tentou incluir informações que não estão no seu CV.");
  }
}

export async function tailorCv(a: Application, onProgress: (e: CvProgress) => void = () => {}) {
  const jobText = jobTextOf(a);
  if (!a.description && !a.responsibilities) {
    throw new Error("Esta aplicação não tem a descrição da vaga. Edite e cole a descrição (ou use Buscar dados) antes de adaptar o CV.");
  }
  onProgress({ step: "analyze" });
  const { cv, analysis } = await analyzeApplication(a);
  const header = cvHeader(cv.markdown);
  const context = buildContext(cv.markdown, cv.facts, jobText, a);
  const instruction = buildInstruction(analysis);

  let feedback = "";
  let violations: string[] = [];
  let model: string | undefined;
  // One retry: on violations, the model gets the exact list of what it must remove.
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await askGemini(instruction + feedback, context, model, (e) =>
      onProgress(e.kind === "try" ? { step: "ai", model: e.model, attempt: attempt + 1 } : { step: "ai-failed", model: e.model, reason: e.reason ?? "" }),
    );
    model = reply.model;
    let answer: AiAnswer;
    try {
      answer = parseJsonAnswer<AiAnswer>(reply.text);
      if (typeof answer.cv !== "string" || !answer.cv.trim()) throw new Error("sem o campo cv");
    } catch (err) {
      onProgress({ step: "invalid-json" });
      if (attempt === 1) throw new Error(`A IA retornou uma resposta ilegível (${err instanceof Error ? err.message : err}).`);
      feedback = "\n\nYOUR PREVIOUS ANSWER WAS NOT VALID JSON. Answer with ONLY the JSON object, escaping newlines inside strings as \\n.";
      continue;
    }

    onProgress({ step: "validate" });
    const markdown = withHeader(answer.cv.trim(), header) + "\n";
    const bridges = (answer.bridges ?? []).filter((b) => analysis.missing.includes(b.tech));
    violations = [
      ...findFabrications(markdown, cv.markdown, cv.facts, jobText),
      ...bridges.flatMap((b) => findBridgeFabrications(`${b.pitch}\n${b.basedOn.join(", ")}`, cv.facts, analysis.jobTechs)),
    ];
    if (!violations.length) {
      const values = {
        applicationId: a.id,
        language: cv.language,
        markdown,
        bridges,
        changes: answer.changes ?? [],
        analysis,
        model: `gemini-cli:${model}`,
        createdAt: new Date(),
      };
      const [row] = await db
        .insert(tailoredCvs)
        .values(values)
        .onConflictDoUpdate({ target: tailoredCvs.applicationId, set: values })
        .returning();
      onProgress({ step: "pdf" });
      // Keep the exact file on disk and record it as the CV sent to this job.
      const cvPath = await saveTailoredPdf(a.id, a.company, await renderPdf(cvDocument(markdown, cv.language)));
      await db.update(applications).set({ cvPath, updatedAt: new Date() }).where(eq(applications.id, a.id));
      onProgress({ step: "done" });
      return { ...row, cvPath };
    }
    onProgress({ step: "rejected", violations });
    feedback = `\n\nYOUR PREVIOUS ANSWER WAS REJECTED because it contained information not present in CANDIDATE FACTS:\n${violations
      .map((v) => `- ${v}`)
      .join("\n")}\nRemove every one of these and answer again.`;
  }
  throw new FabricationError(violations);
}

function buildContext(cv: string, facts: string, jobText: string, a: Application) {
  return [
    "=== BASE CV (markdown, the one to tailor) ===",
    cv,
    "=== CANDIDATE FACTS (all CV versions; the ONLY source of truth about the candidate) ===",
    facts,
    "=== JOB POSTING ===",
    [a.company && `Company: ${a.company}`, a.role && `Role: ${a.role}`].filter(Boolean).join("\n"),
    jobText,
  ].join("\n\n");
}

function buildInstruction(an: ReturnType<typeof analyzeFit>) {
  const lang = an.language === "pt" ? "Brazilian Portuguese" : "English";
  return `You are an expert technical recruiter tailoring a resume to pass an ATS for the job posting given on stdin.

HARD RULES (a program verifies them and rejects violations):
1. Use ONLY facts stated in CANDIDATE FACTS. Never add technologies, tools, companies, job titles, dates, numbers, metrics, certifications, domains or responsibilities that are not explicitly there.
2. Do NOT borrow claims from the job posting: architectures, practices, methodologies, domains or activities (e.g. "microservices", "refactoring", "agile") may appear only if CANDIDATE FACTS state them. Use the posting's wording only as a synonym for something the facts already say.
3. Never claim, even indirectly, experience with: ${an.missing.join(", ") || "(none)"}. Do not mention these anywhere in the CV.
4. Keep the markdown structure of BASE CV: header block unchanged, the same sections, every "### " heading kept verbatim and in the same order, same dates.
5. Write the CV in ${lang}. Keep it concise (max ~2 pages).

WHAT YOU SHOULD DO to raise the ATS match:
- Rewrite the summary to lead with the facts most relevant to this job, using the posting's own wording where it describes something the candidate really did.
- Reorder skill lines and the items inside them so the job's keywords come first. Matched keywords: ${an.matched.join(", ") || "(none)"}.
- These keywords are true per another CV version and should be included where they fit: ${an.fromOtherCv.join(", ") || "(none)"}.
- Reorder bullets inside each experience (most relevant first) and rephrase them with the posting's terminology, without changing their meaning or numbers.

ALSO, for each technology in [${an.missing.join(", ")}], write an interview/cover-letter note (in ${lang}) explaining honestly that the candidate has not used it professionally, and which concrete experience from CANDIDATE FACTS will make learning it fast (similar concepts, ecosystem, patterns). Plus a short study plan focused on what differs from what they already know.

Answer with ONLY a JSON object, no prose:
{"cv": "<full tailored CV markdown>", "bridges": [{"tech": "<missing tech>", "basedOn": ["<techs from facts>"], "pitch": "<2-4 sentences>", "studyPlan": "<3-5 short steps>"}], "changes": ["<short description of each change made>"]}`;
}
