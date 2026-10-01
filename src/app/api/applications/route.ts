import { NextResponse, type NextRequest } from "next/server";
import { createApplication, listApplications } from "@/lib/applications";
import { validationError } from "@/lib/api";
import { applicationInput, parseFilters } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const rows = await listApplications(parseFilters(req.nextUrl.searchParams));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const parsed = applicationInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const row = await createApplication(parsed.data);
  return NextResponse.json(row, { status: 201 });
}
