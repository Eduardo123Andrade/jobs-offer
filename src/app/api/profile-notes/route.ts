import { NextResponse, type NextRequest } from "next/server";
import { validationError } from "@/lib/api";
import { createProfileNote, listProfileNotes } from "@/lib/profile-notes";
import { profileNoteInput } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(await listProfileNotes());
}

export async function POST(req: NextRequest) {
  const parsed = profileNoteInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);
  return NextResponse.json(await createProfileNote(parsed.data), { status: 201 });
}
