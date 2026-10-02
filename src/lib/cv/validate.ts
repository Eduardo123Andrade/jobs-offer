import { extractTechnologies } from "@/lib/scrape/extract";

/**
 * Anti-fabrication checks for an AI-tailored CV. The model is told not to invent anything; this makes
 * that a hard guarantee instead of a hope: every technology, number, job heading and job-specific
 * proper noun in the output must already exist in the candidate's own CV files (`facts`).
 * Returns human-readable violations (empty = OK).
 */
export function findFabrications(generated: string, original: string, facts: string, jobText: string): string[] {
  const violations: string[] = [];

  const factTechs = new Set(extractTechnologies(facts));
  for (const tech of extractTechnologies(generated)) {
    if (!factTechs.has(tech)) violations.push(`Tecnologia que não está no seu CV: ${tech}`);
  }

  const factNumbers = new Set(numbers(facts));
  for (const n of new Set(numbers(generated))) {
    if (!factNumbers.has(n)) violations.push(`Número/métrica que não está no seu CV: ${n}`);
  }

  const factHeadings = new Set(headings(facts));
  const outHeadings = headings(generated);
  for (const h of outHeadings) {
    if (!factHeadings.has(h)) violations.push(`Experiência/projeto que não está no seu CV: "${h}"`);
  }
  for (const h of headings(original)) {
    if (!outHeadings.includes(h)) violations.push(`Experiência/projeto removido: "${h}"`);
  }

  // Capitalized terms copied from the job ad (tools, products, certifications...) that the CV never mentions.
  const factWords = wordSet(facts);
  const jobWords = wordSet(jobText);
  for (const term of new Set(properNouns(generated))) {
    const key = term.toLowerCase();
    if (!factWords.has(key) && jobWords.has(key)) violations.push(`Termo da vaga que não está no seu CV: ${term}`);
  }

  return violations;
}

/** Same check for the interview notes: they may name the missing tech, but must only credit real experience. */
export function findBridgeFabrications(text: string, facts: string, jobTechs: string[]): string[] {
  const allowed = new Set([...extractTechnologies(facts), ...jobTechs]);
  return extractTechnologies(text)
    .filter((t) => !allowed.has(t))
    .map((t) => `Nota cita tecnologia que não está no seu CV nem na vaga: ${t}`);
}

// Common words that say nothing about the candidate; everything else copied from the job is worth a look.
const STOPWORDS = new Set(
  "about above after again against also among área através being before below between both cada como contra could desde dessa desse desta deste does doing during each entre essa esse esta este estar estão from further have having into isso mais mesmo muito nossa nosso other para pela pelo pelas pelos porque quando sobre suas seus such than that their them then there these they this those through under until very well were what when where which while will with would your você vocês sendo será serão também todas todos toda todo uma umas uns".split(" "),
);

/**
 * Soft check: words the AI took from the job posting that appear nowhere in the candidate's CVs.
 * Not necessarily false (the posting's wording may describe something they did), so they're shown
 * for review instead of rejecting the CV.
 */
export function findJobOnlyWords(generated: string, facts: string, jobText: string): string[] {
  // Crude stemming (first 7 letters) so "refatoração" in the CV matches "refatorar" in the job.
  const stem = (w: string) => w.slice(0, 7);
  const factStems = new Set([...wordSet(facts)].map(stem));
  const jobStems = new Set([...wordSet(jobText)].map(stem));
  return [...wordSet(generated)].filter(
    (w) => w.length >= 5 && !STOPWORDS.has(w) && jobStems.has(stem(w)) && !factStems.has(stem(w)),
  );
}

const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));

const headings = (md: string) =>
  md
    .split("\n")
    .filter((l) => l.startsWith("### "))
    .map((l) => l.slice(4).trim());

const wordSet = (text: string) => new Set((text.match(/[\p{L}][\p{L}\p{N}+#.-]*/gu) ?? []).map((w) => w.toLowerCase().replace(/\.$/, "")));

/** Words with a capital letter that don't start a sentence, line or markdown element. */
function properNouns(md: string): string[] {
  const out: string[] = [];
  for (const line of md.split("\n")) {
    const re = /[\p{L}][\p{L}\p{N}+#.-]*/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const word = m[0].replace(/\.$/, "");
      if (!/\p{Lu}/u.test(word)) continue;
      const before = line.slice(0, m.index).trimEnd();
      const startsSentence = before === "" || /[.!?:#*>|\-–—•(]$/.test(before) || /^[-*#>\s]*(\*\*)?$/.test(before);
      if (!startsSentence) out.push(word);
    }
  }
  return out;
}
