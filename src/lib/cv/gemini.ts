import "server-only";
import { QuotaError, runCli } from "./cli";

const BIN = process.env.GEMINI_BIN ?? "gemini";
// Primary: flash-lite, which answers in 30s–1.5min. Fallback: GEMINI_FALLBACK_MODEL or the CLI's default
// (stronger, but often overloaded → minutes of 503 retries). The anti-fabrication check applies to both.
const PRIMARY = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const FALLBACK = process.env.GEMINI_FALLBACK_MODEL || undefined; // undefined → CLI default
const PRIMARY_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 180_000);
const FALLBACK_TIMEOUT_MS = 180_000;

export const name = "Gemini";

export const models: { model?: string; timeout: number }[] = [
  { model: PRIMARY, timeout: PRIMARY_TIMEOUT_MS },
  ...(FALLBACK !== PRIMARY ? [{ model: FALLBACK, timeout: FALLBACK_TIMEOUT_MS }] : []),
];

/** Runs the Gemini CLI headless once. The (large) context goes through stdin; `-p` carries the instruction. */
export async function callOnce(instruction: string, context: string, model: string | undefined, timeout: number) {
  // --skip-trust: the temp dir runCli uses is never a trusted folder.
  const args = ["-p", instruction, "-o", "json", "--skip-trust", ...(model ? ["-m", model] : [])];
  const { stdout, stderr, code } = await runCli(BIN, args, context, timeout, "Instale com: npm i -g @google/gemini-cli");
  let parsed: { response?: string; error?: { message?: string; code?: number } };
  try {
    // On errors the CLI prints its JSON to stderr after a debug dump; start at the JSON object itself.
    const out = stdout.trim() ? stdout : stderr;
    const start = out.search(/^\{\s*\n\s*"session_id"/m);
    parsed = JSON.parse(start === -1 ? out : out.slice(start));
  } catch {
    throw new Error(`saiu com código ${code}: ${(stderr || stdout).trim().slice(-300)}`);
  }
  if (parsed.error?.code === 429) {
    throw new QuotaError("cota diária esgotada para este modelo (renova por volta das 4h–5h, horário de Brasília)");
  }
  if (parsed.error) throw new Error(parsed.error.message ?? "erro desconhecido");
  if (!parsed.response) throw new Error("não retornou resposta");
  return parsed.response;
}
