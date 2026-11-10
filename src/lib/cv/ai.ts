import "server-only";
import * as claude from "./claude";
import { QuotaError } from "./cli";
import * as gemini from "./gemini";

// Which CLI tailors the CV: CV_AI_PROVIDER=gemini (default) or claude.
const providers = { gemini, claude };
const providerKey = (process.env.CV_AI_PROVIDER || "gemini").toLowerCase();

// Free-tier keys and subscriptions have usage limits per model. Once a model answers 429, skip it for a
// while instead of paying its failure on every generation. In memory only: a server restart forgets it.
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000;
const exhaustedUntil = new Map<string, number>();

export type AiAnswer = { text: string; model: string };

/**
 * Asks the configured AI CLI, trying its primary model first and the fallback if it fails or times out.
 * `prefer` lets a follow-up call go straight to the model that answered before.
 */
export async function askAi(
  instruction: string,
  context: string,
  prefer?: string,
  onEvent?: (e: { kind: "try" | "failed"; model: string; reason?: string }) => void,
): Promise<AiAnswer> {
  const provider = providers[providerKey as keyof typeof providers];
  if (!provider) throw new Error(`CV_AI_PROVIDER inválido: "${providerKey}". Use "gemini" ou "claude".`);

  const models = [...provider.models];
  if (prefer) models.sort((a, b) => Number(label(b.model) === prefer) - Number(label(a.model) === prefer));

  const errors: string[] = [];
  for (const { model, timeout } of models) {
    const name = label(model);
    if ((exhaustedUntil.get(name) ?? 0) > Date.now()) {
      errors.push(`${name}: limite de uso esgotado (pulado)`);
      continue;
    }
    onEvent?.({ kind: "try", model: name });
    try {
      return { text: await provider.callOnce(instruction, context, model, timeout), model: name };
    } catch (err) {
      if (err instanceof QuotaError) exhaustedUntil.set(name, Date.now() + QUOTA_COOLDOWN_MS);
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${reason}`);
      onEvent?.({ kind: "failed", model: name, reason });
    }
  }
  throw new Error(`${provider.name} falhou. ${errors.join(" | ")}`);
}

/** Tag stored with each tailored CV, e.g. "claude-cli:sonnet". */
export const modelTag = (model: string) => `${providerKey}-cli:${model}`;

const label = (model?: string) => model ?? "padrão";

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
