import { NextResponse } from "next/server";
import { z } from "zod";

export function validationError(error: z.ZodError) {
  return NextResponse.json({ error: "Dados inválidos", fields: z.flattenError(error).fieldErrors }, { status: 400 });
}

export function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const notFound = () => NextResponse.json({ error: "Aplicação não encontrada" }, { status: 404 });
