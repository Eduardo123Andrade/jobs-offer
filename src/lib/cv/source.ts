import "server-only";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { listCvNotes } from "@/lib/profile-notes";
import type { CvLanguage } from "./analyze";

// Personal files, kept out of git (see .gitignore). Both languages plus the "Sobre mim" blocks marked
// "usar no CV" are the "facts": anything stated in any of them may appear in a tailored CV.
export const CV_DIR = path.resolve(process.env.CV_DIR ?? path.join(process.cwd(), "cv"));
const FILES: Record<CvLanguage, string> = { en: "cv-en.md", pt: "cv-pt.md" };

export type CvSource = { language: CvLanguage; markdown: string; facts: string };

async function tryRead(file: string) {
  try {
    return await readFile(path.join(CV_DIR, file), "utf8");
  } catch {
    return null;
  }
}

export async function loadCv(language: CvLanguage): Promise<CvSource> {
  const [en, pt, notes] = await Promise.all([tryRead(FILES.en), tryRead(FILES.pt), listCvNotes()]);
  const wanted = language === "en" ? en : pt;
  const fallback = language === "en" ? pt : en;
  const markdown = wanted ?? fallback;
  if (!markdown) throw new Error(`Nenhum CV encontrado. Coloque ${FILES.en} e/ou ${FILES.pt} em ${CV_DIR}.`);
  return {
    language: wanted ? language : language === "en" ? "pt" : "en",
    markdown,
    facts: [en, pt, notesAsMarkdown(notes)].filter(Boolean).join("\n\n"),
  };
}

/** Name/title/contact block: everything before the first `---`. Never touched by the AI. */
export function cvHeader(md: string) {
  const i = md.search(/^---\s*$/m);
  return i === -1 ? "" : md.slice(0, i);
}

export function withHeader(md: string, header: string) {
  if (!header) return md;
  const i = md.search(/^---\s*$/m);
  return header + (i === -1 ? md : md.slice(i));
}

/** Resolves a stored cvPath inside CV_DIR; null if it would escape the folder. */
export function resolveCvPath(relative: string) {
  const full = path.resolve(CV_DIR, relative);
  return full.startsWith(CV_DIR + path.sep) ? full : null;
}

/** Every PDF/DOCX under CV_DIR (relative paths), to pick which CV was sent to a job. */
export async function listCvFiles(): Promise<string[]> {
  try {
    const entries = await readdir(CV_DIR, { recursive: true, withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && /\.(pdf|docx?)$/i.test(e.name))
      .map((e) => path.relative(CV_DIR, path.join(e.parentPath, e.name)))
      .sort();
  } catch {
    return [];
  }
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Saves a tailored CV PDF as cv/aplicacoes/<id>-<company>.pdf and returns its path relative to CV_DIR. */
export async function saveTailoredPdf(applicationId: number, company: string | null, pdf: Buffer) {
  const relative = path.join("aplicacoes", [applicationId, company && slug(company)].filter(Boolean).join("-") + ".pdf");
  await mkdir(path.join(CV_DIR, "aplicacoes"), { recursive: true });
  await writeFile(path.join(CV_DIR, relative), pdf);
  return relative;
}

function notesAsMarkdown(notes: { title: string; content: string }[]) {
  if (!notes.length) return "";
  // "####" so these never count as experience headings ("### ") in the anti-fabrication check.
  return ["## Sobre mim (anotações do candidato)", ...notes.map((n) => `#### ${n.title || "Sem título"}\n${n.content}`)].join("\n\n");
}
