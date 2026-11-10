import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** The model's quota/rate limit is exhausted: ai.ts skips it for a while instead of retrying on every run. */
export class QuotaError extends Error {}

/**
 * Runs an AI CLI headless with `stdin` as input. It runs in an empty temp dir so the CLI doesn't pick up
 * this repo's files (or its CLAUDE.md/GEMINI.md) as context.
 */
export async function runCli(bin: string, args: string[], stdin: string, timeout: number, installHint: string) {
  const cwd = await mkdtemp(path.join(tmpdir(), "jobs-offer-ai-"));
  try {
    return await run(bin, args, stdin, cwd, timeout, installHint);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

function run(bin: string, args: string[], stdin: string, cwd: string, timeout: number, installHint: string) {
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
          ? new Error(`CLI não encontrado ("${bin}"). ${installHint}`)
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
