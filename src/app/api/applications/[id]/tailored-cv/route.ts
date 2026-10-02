import { NextResponse, type NextRequest } from "next/server";
import { getApplication } from "@/lib/applications";
import { notFound, parseId } from "@/lib/api";
import { FabricationError, tailorCv } from "@/lib/cv/tailor";

/** Generates (or regenerates) the tailored CV with the Gemini CLI. Takes from ~20s to a few minutes. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]/tailored-cv">) {
  const id = parseId((await ctx.params).id);
  const application = id && (await getApplication(id));
  if (!application) return notFound();
  try {
    return NextResponse.json(await tailorCv(application));
  } catch (err) {
    if (err instanceof FabricationError) {
      return NextResponse.json({ error: err.message, violations: err.violations }, { status: 422 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao gerar o CV" }, { status: 500 });
  }
}
