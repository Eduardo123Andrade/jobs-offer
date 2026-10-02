import type { CvAnalysis } from "@/db/schema";
import { extractTechnologies } from "@/lib/scrape/extract";

export type CvLanguage = CvAnalysis["language"];

const PT_MARKERS = /\b(de|para|com|você|voce|vaga|experiência|experiencia|conhecimento|desenvolvimento|requisitos|empresa|não|será)\b|ção\b|ções\b/gi;
const EN_MARKERS = /\b(the|and|with|you|we|our|experience|knowledge|development|requirements|will|years|team)\b/gi;

/** Guesses whether a job posting is in Portuguese or English by counting common words. */
export function detectLanguage(text: string): CvLanguage {
  const pt = text.match(PT_MARKERS)?.length ?? 0;
  const en = text.match(EN_MARKERS)?.length ?? 0;
  return pt >= en ? "pt" : "en";
}

const unique = (xs: string[]) => [...new Set(xs)];

/**
 * Deterministic ATS-style keyword match between a job and the CV, no AI involved.
 * - matched: in the job and in the CV of the chosen language
 * - fromOtherCv: in the job, missing from this CV but true per the other-language CV (safe to add)
 * - missing: in the job and in no CV at all — never to be claimed
 */
export function analyzeFit(jobText: string, jobTechs: string[], cv: string, facts: string, language: CvLanguage): CvAnalysis {
  const required = unique([...extractTechnologies(jobText), ...jobTechs]);
  const inCv = new Set(extractTechnologies(cv));
  const inFacts = new Set(extractTechnologies(facts));
  const matched = required.filter((t) => inCv.has(t));
  const fromOtherCv = required.filter((t) => !inCv.has(t) && inFacts.has(t));
  const missing = required.filter((t) => !inFacts.has(t));
  const score = required.length ? Math.round((matched.length / required.length) * 100) : 0;
  return { language, jobTechs: required, matched, fromOtherCv, missing, score };
}

/** Score of an arbitrary CV text against the job's keywords (used to compare before/after). */
export function scoreCv(cv: string, jobTechs: string[]) {
  if (!jobTechs.length) return 0;
  const inCv = new Set(extractTechnologies(cv));
  return Math.round((jobTechs.filter((t) => inCv.has(t)).length / jobTechs.length) * 100);
}
