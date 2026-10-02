import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api";
import { scrapeJob } from "@/lib/scrape";

const body = z.object({ url: z.url().trim() });

export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  return NextResponse.json(await scrapeJob(parsed.data.url));
}
