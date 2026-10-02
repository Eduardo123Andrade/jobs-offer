import type { NextRequest } from "next/server";
import { getApplication } from "@/lib/applications";
import { notFound, parseId } from "@/lib/api";
import { progressLabel, type CvStreamLine } from "@/lib/cv/progress";
import { FabricationError, tailorCv } from "@/lib/cv/tailor";

/**
 * Generates (or regenerates) the tailored CV with the Gemini CLI. Takes from ~20s to a few minutes, so
 * progress is streamed as NDJSON (one CvStreamLine per line) and also logged to the server console.
 */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]/tailored-cv">) {
  const id = parseId((await ctx.params).id);
  const application = id && (await getApplication(id));
  if (!application) return notFound();

  const encoder = new TextEncoder();
  const started = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: CvStreamLine) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      try {
        await tailorCv(application, (event) => {
          const elapsedMs = Date.now() - started;
          console.log(`[cv #${application.id}] ${(elapsedMs / 1000).toFixed(0)}s ${progressLabel(event)}`);
          send({ type: "progress", event, elapsedMs });
        });
        send({ type: "done" });
      } catch (err) {
        const error = err instanceof Error ? err.message : "Erro ao gerar o CV";
        console.log(`[cv #${application.id}] erro: ${error}`);
        send({ type: "error", error, violations: err instanceof FabricationError ? err.violations : undefined });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" },
  });
}
