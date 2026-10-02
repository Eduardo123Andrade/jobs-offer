#!/usr/bin/env node
// Starts the database container for an environment, applies migrations, runs Next.js,
// and stops that container when Next exits (including on Ctrl+C).
//
//   node scripts/run.mjs dev    → db-dev  (5434) + next dev   on :3000, seeds fake data if empty
//   node scripts/run.mjs prod   → db-prod (5435) + next build/start on :3002, never seeded or reset

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";

const MODES = {
  dev: {
    service: "db-dev",
    envFile: ".env.development",
    steps: [["tsx", "scripts/seed.ts", "--if-empty"]],
    app: ["next", "dev", "--port", "3000"],
  },
  prod: {
    service: "db-prod",
    envFile: ".env.production",
    volume: "jobs-offer-pgdata-prod",
    steps: [["next", "build"]],
    app: ["next", "start", "--port", "3002"],
  },
};

const mode = MODES[process.argv[2]];
if (!mode) {
  console.error("Uso: node scripts/run.mjs <dev|prod>");
  process.exit(1);
}

const env = { ...process.env, ...parse(readFileSync(mode.envFile)) };
const log = (msg) => console.log(`\x1b[36m[${process.argv[2]}]\x1b[0m ${msg}`);

let shuttingDown = false;
let current = null;

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", env, ...opts });
    if (!opts.detached) current = child;
    child.on("exit", (code, signal) => {
      if (current === child) current = null;
      resolve(signal ? 1 : (code ?? 1));
    });
    child.on("error", (err) => {
      console.error(err.message);
      resolve(1);
    });
  });
}

const npx = (args) => run("pnpm", ["exec", ...args]);

function isRunning(service) {
  return new Promise((resolve) => {
    const child = spawn("docker", ["compose", "ps", "--status", "running", "-q", service], { env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("exit", () => resolve(out.trim() !== ""));
    child.on("error", () => resolve(false));
  });
}

// Only stop the container if this run started it, so a second instance (or one that
// fails, e.g. port in use) doesn't pull the database out from under the first.
let startedDatabase = false;

async function stopDatabase() {
  if (!startedDatabase) {
    log(`${mode.service} já estava rodando antes; mantendo o container ligado.`);
    return;
  }
  log(`parando o container ${mode.service}...`);
  // Own process group, so a second Ctrl+C can't interrupt the stop.
  await run("docker", ["compose", "stop", mode.service], { detached: true });
}

// Ctrl+C reaches every process in the foreground group (Next included), so we only
// record it here and let the running step exit on its own before cleaning up.
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    if (!shuttingDown) log("encerrando...");
    shuttingDown = true;
    if (sig !== "SIGINT") current?.kill(sig);
  });
}

async function main() {
  if (mode.volume) {
    await run("docker", ["volume", "create", mode.volume], { stdio: "ignore" });
  }

  startedDatabase = !(await isRunning(mode.service));
  log(`subindo ${mode.service}...`);
  let code = await run("docker", ["compose", "up", "-d", "--wait", mode.service]);
  if (code !== 0 || shuttingDown) return code;

  for (const step of [["drizzle-kit", "migrate"], ...mode.steps, mode.app]) {
    code = await npx(step);
    if (code !== 0 || shuttingDown) return code;
  }
  return code;
}

const code = await main();
await stopDatabase();
process.exit(shuttingDown ? 0 : code);
