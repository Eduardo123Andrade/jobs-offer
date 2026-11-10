import "server-only";
import { QuotaError, runCli } from "./cli";

const BIN = process.env.CLAUDE_BIN ?? "claude";
// Aliases ("sonnet", "opus", "haiku") always point to the latest model of that tier.
const PRIMARY = process.env.CLAUDE_MODEL || "sonnet";
const FALLBACK = process.env.CLAUDE_FALLBACK_MODEL || undefined;
const TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS ?? 300_000);

export const name = "Claude";

export const models: { model?: string; timeout: number }[] = [
  { model: PRIMARY, timeout: TIMEOUT_MS },
  ...(FALLBACK && FALLBACK !== PRIMARY ? [{ model: FALLBACK, timeout: TIMEOUT_MS }] : []),
];

/**
 * Runs Claude Code headless once, as a plain completion: no tools, MCP servers, slash commands or saved
 * session. The (large) context goes through stdin; `-p` carries the instruction.
 */
export async function callOnce(instruction: string, context: string, model: string | undefined, timeout: number) {
  const args = [
    "-p", instruction,
    "--output-format", "json",
    "--tools", "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
    ...(model ? ["--model", model] : []),
  ];
  const { stdout, stderr, code } = await runCli(BIN, args, context, timeout, "Instale com: npm i -g @anthropic-ai/claude-code");
  let parsed: { is_error?: boolean; result?: string; api_error_status?: number | null };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`saiu com código ${code}: ${(stderr || stdout).trim().slice(-300)}`);
  }
  if (parsed.api_error_status === 429) {
    throw new QuotaError(`limite de uso atingido para este modelo${parsed.result ? ` (${parsed.result})` : ""}`);
  }
  if (parsed.is_error) throw new Error(parsed.result || "erro desconhecido");
  if (!parsed.result) throw new Error("não retornou resposta");
  return parsed.result;
}
