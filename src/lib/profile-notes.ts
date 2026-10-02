import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { profileNotes } from "@/db/schema";
import type { ProfileNoteInput } from "./validation";

export async function listProfileNotes() {
  return db.select().from(profileNotes).orderBy(asc(profileNotes.createdAt), asc(profileNotes.id));
}

export async function createProfileNote(input: ProfileNoteInput) {
  const [row] = await db.insert(profileNotes).values(input).returning();
  return row;
}

export async function updateProfileNote(id: number, input: Partial<ProfileNoteInput>) {
  const [row] = await db
    .update(profileNotes)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(profileNotes.id, id))
    .returning();
  return row ?? null;
}

export async function deleteProfileNote(id: number) {
  const rows = await db.delete(profileNotes).where(eq(profileNotes.id, id)).returning({ id: profileNotes.id });
  return rows.length > 0;
}

/** Notes the user marked as usable by the CV-tailoring AI (empty ones skipped). */
export async function listCvNotes() {
  return db
    .select()
    .from(profileNotes)
    .where(and(eq(profileNotes.useInCv, true), ne(profileNotes.content, "")))
    .orderBy(asc(profileNotes.createdAt), asc(profileNotes.id));
}
