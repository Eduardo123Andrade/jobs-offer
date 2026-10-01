import { NextResponse, type NextRequest } from "next/server";
import { computeStats, listApplications } from "@/lib/applications";
import { parseFilters } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const rows = await listApplications(parseFilters(req.nextUrl.searchParams));
  return NextResponse.json(computeStats(rows));
}
