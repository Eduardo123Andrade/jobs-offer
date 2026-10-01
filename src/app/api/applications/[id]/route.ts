import { NextResponse, type NextRequest } from "next/server";
import { deleteApplication, getApplication, updateApplication } from "@/lib/applications";
import { notFound, parseId, validationError } from "@/lib/api";
import { applicationPatch } from "@/lib/validation";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]">) {
  const id = parseId((await ctx.params).id);
  const row = id && (await getApplication(id));
  return row ? NextResponse.json(row) : notFound();
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/applications/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return notFound();
  const parsed = applicationPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const row = await updateApplication(id, parsed.data);
  return row ? NextResponse.json(row) : notFound();
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]">) {
  const id = parseId((await ctx.params).id);
  const deleted = id && (await deleteApplication(id));
  return deleted ? new NextResponse(null, { status: 204 }) : notFound();
}
