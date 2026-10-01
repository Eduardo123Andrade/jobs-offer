import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// scripts/run.mjs passes DATABASE_URL explicitly; standalone db:* commands target the dev database.
if (!process.env.DATABASE_URL) config({ path: ".env.development", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
