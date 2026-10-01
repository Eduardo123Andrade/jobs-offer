// Fake data for the DEV database only.
//
//   tsx scripts/seed.ts             → wipes applications and inserts fake ones
//   tsx scripts/seed.ts --if-empty  → only seeds when the table is empty (used by `pnpm dev`)
//   tsx scripts/seed.ts --reset     → drops the whole schema, re-runs migrations, then seeds
//
// Refuses to run against any database other than jobs_offer_dev.

import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { applications, type NewApplication } from "../src/db/schema";
import { STATUSES, WORK_MODELS, type Status } from "../src/lib/constants";

const DEV_DATABASE = "jobs_offer_dev";

if (!process.env.DATABASE_URL) config({ path: ".env.development", quiet: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const args = new Set(process.argv.slice(2));

async function main() {
  const { rows } = await pool.query<{ db: string }>("select current_database() as db");
  if (rows[0].db !== DEV_DATABASE) {
    throw new Error(`Seed/reset bloqueado: banco atual é "${rows[0].db}", só é permitido em "${DEV_DATABASE}".`);
  }

  if (args.has("--reset")) {
    console.log("Resetando o banco de dev...");
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await migrate(db, { migrationsFolder: "drizzle" });
  } else if (args.has("--if-empty")) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(applications);
    if (count > 0) return;
  } else {
    await db.delete(applications);
  }

  const data = fakeApplications(40);
  await db.insert(applications).values(data);
  console.log(`Seed: ${data.length} aplicações fake inseridas no banco de dev.`);
}

// ---------- fake data ----------

const COMPANIES = ["Nubank", "iFood", "Stone", "Mercado Livre", "QuintoAndar", "Hotmart", "PicPay", "VTEX", "Creditas", "Loft", "Totvs", "CI&T", "Zé Delivery", "Olist", "Wildlife"];
const ROLES = ["Desenvolvedor Frontend", "Desenvolvedor Fullstack", "Engenheiro de Software Pleno", "Desenvolvedor React Sênior", "Tech Lead", "Engenheiro Backend Node.js"];
const PLATFORMS = ["LinkedIn", "LinkedIn", "LinkedIn", "Gupy", "Gupy", "Indeed", "Glassdoor", "Site da empresa", "Indicação"];
const LOCATIONS = ["São Paulo, SP", "Rio de Janeiro, RJ", "Belo Horizonte, MG", "Curitiba, PR", "Florianópolis, SC", "Porto Alegre, RS", "Remoto"];
const STATUS_WEIGHTS: Record<Status, number> = {
  saved: 2, applied: 10, in_review: 5, interview: 4, technical_test: 2, offer: 1, rejected: 8, withdrawn: 1,
};
const RECRUITERS = ["Ana Souza", "Bruno Lima", "Carla Mendes", "Diego Rocha", "Fernanda Alves"];
const NOTES = ["Stack: React + Next.js", "Vaga com inglês avançado", "Benefícios bons, sem PLR", "Processo com 4 etapas", "Recrutadora respondeu rápido"];

// Deterministic PRNG so every reset produces the same data.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const maybe = <T,>(p: number, v: () => T) => (rand() < p ? v() : null);

function weightedStatus(): Status {
  const total = Object.values(STATUS_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (const s of STATUSES) if ((r -= STATUS_WEIGHTS[s]) < 0) return s;
  return "applied";
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const isoDate = (d: Date) => d.toLocaleDateString("en-CA");

function fakeApplications(n: number): NewApplication[] {
  return Array.from({ length: n }, (_, i) => {
    const company = pick(COMPANIES);
    const platform = pick(PLATFORMS);
    const location = pick(LOCATIONS);
    const status = weightedStatus();
    const appliedDaysAgo = Math.floor(rand() * 90);
    const statusDaysAgo = Math.floor(rand() * appliedDaysAgo);
    const recruiter = maybe(0.4, () => pick(RECRUITERS));
    const slug = company.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    return {
      url: platform === "Gupy" ? `https://${slug}.gupy.io/jobs/${1000 + i}` : `https://www.linkedin.com/jobs/view/${4_000_000 + i * 37}`,
      company: maybe(0.9, () => company),
      role: maybe(0.9, () => pick(ROLES)),
      platform,
      status,
      appliedAt: isoDate(daysAgo(appliedDaysAgo)),
      location,
      workModel: location === "Remoto" ? "remote" : maybe(0.85, () => pick(WORK_MODELS)),
      salary: maybe(0.4, () => `R$ ${8 + Math.floor(rand() * 12)}.000 CLT`),
      contactName: recruiter,
      contactEmail: recruiter && `${recruiter.split(" ")[0].toLowerCase()}@${slug}.com.br`,
      notes: maybe(0.35, () => pick(NOTES)),
      followUpAt: maybe(0.35, () => isoDate(daysAgo(Math.floor(rand() * 20) - 10))),
      statusChangedAt: daysAgo(statusDaysAgo),
      createdAt: daysAgo(appliedDaysAgo),
    };
  });
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
