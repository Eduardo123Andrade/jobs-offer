import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const BIN = process.env.GEMINI_BIN ?? "gemini";
// Primary: GEMINI_MODEL or the CLI's default (best quality, but often overloaded → slow 503 retries).
// Fallback: a lighter model that answers in seconds. The anti-fabrication check applies to both.
const PRIMARY = process.env.GEMINI_MODEL || undefined;
const FALLBACK = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite";
const PRIMARY_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 150_000);
const FALLBACK_TIMEOUT_MS = 120_000;

export type GeminiAnswer = { text: string; model: string };

/**
 * Asks Gemini, trying the primary model first and the fallback if it fails or times out.
 * `prefer` lets a follow-up call go straight to the model that answered before.
 */
export async function askGemini(
  instruction: string,
  context: string,
  prefer?: string,
  onEvent?: (e: { kind: "try" | "failed"; model: string; reason?: string }) => void,
): Promise<GeminiAnswer> {
  const models: { model?: string; timeout: number }[] = [
    { model: PRIMARY, timeout: PRIMARY_TIMEOUT_MS },
    ...(FALLBACK && FALLBACK !== PRIMARY ? [{ model: FALLBACK, timeout: FALLBACK_TIMEOUT_MS }] : []),
  ];
  if (prefer) models.sort((a, b) => Number(label(b.model) === prefer) - Number(label(a.model) === prefer));

  const errors: string[] = [];
  for (const { model, timeout } of models) {
    onEvent?.({ kind: "try", model: label(model) });
    try {
      return { text: await callOnce(instruction, context, model, timeout), model: label(model) };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${label(model)}: ${reason}`);
      onEvent?.({ kind: "failed", model: label(model), reason });
    }
  }
  throw new Error(`Gemini falhou. ${errors.join(" | ")}`);
}

const label = (model?: string) => model ?? "padrão";

/**
 * Runs the Gemini CLI headless once. The (large) context goes through stdin; `-p` carries the instruction.
 * It runs in an empty temp dir (hence --skip-trust) so the CLI doesn't pick up this repo's files as context.
 */
async function callOnce(instruction: string, context: string, model: string | undefined, timeout: number) {
  const cwd = await mkdtemp(path.join(tmpdir(), "jobs-offer-gemini-"));
  const args = ["-p", instruction, "-o", "json", "--skip-trust", ...(model ? ["-m", model] : [])];
  try {
    const { stdout, stderr, code } = await run(BIN, args, context, cwd, timeout);
    let parsed: { response?: string; error?: { message?: string } };
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new Error(`saiu com código ${code}: ${(stderr || stdout).trim().slice(-300)}`);
    }
    if (parsed.error) throw new Error(parsed.error.message ?? "erro desconhecido");
    if (!parsed.response) throw new Error("não retornou resposta");
    return parsed.response;
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

function run(bin: string, args: string[], stdin: string, cwd: string, timeout: number) {
  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`tempo esgotado (${Math.round(timeout / 1000)}s)`));
    }, timeout);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        (err as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error(`Gemini CLI não encontrado ("${bin}"). Instale com: npm i -g @google/gemini-cli`)
          : err,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    child.stdin.end(stdin);
  });
}

/**
 * Pulls the first JSON object out of a model answer. Tolerates ```json fences, chatter around it and
 * raw newlines/tabs inside strings (models often emit multi-line markdown without escaping it).
 */
export function parseJsonAnswer<T>(answer: string): T {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("A IA não retornou JSON.");
  return JSON.parse(escapeControlCharsInStrings(answer.slice(start, end + 1))) as T;
}

function escapeControlCharsInStrings(json: string) {
  let out = "";
  let inString = false;
  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (inString && c === "\\") {
      out += c + (json[++i] ?? "");
      continue;
    }
    if (c === '"') inString = !inString;
    if (inString && c < " ") {
      out += c === "\n" ? "\\n" : c === "\r" ? "\\r" : c === "\t" ? "\\t" : "";
      continue;
    }
    out += c;
  }
  return out;
}
