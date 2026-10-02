import { NextResponse, type NextRequest } from "next/server";
import { parseId, validationError } from "@/lib/api";
import { deleteProfileNote, updateProfileNote } from "@/lib/profile-notes";
import { profileNotePatch } from "@/lib/validation";

const notFound = () => NextResponse.json({ error: "Bloco não encontrado" }, { status: 404 });

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/profile-notes/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return notFound();
  const parsed = profileNotePatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const row = await updateProfileNote(id, parsed.data);
  return row ? NextResponse.json(row) : notFound();
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/profile-notes/[id]">) {
  const id = parseId((await ctx.params).id);
  const deleted = id && (await deleteProfileNote(id));
  return deleted ? new NextResponse(null, { status: 204 }) : notFound();
}
