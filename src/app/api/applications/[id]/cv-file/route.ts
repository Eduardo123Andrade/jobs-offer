import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getApplication } from "@/lib/applications";
import { notFound, parseId } from "@/lib/api";
import { resolveCvPath } from "@/lib/cv/source";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Opens the CV file that was sent to this application (inline, so PDFs show in the browser). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]/cv-file">) {
  const id = parseId((await ctx.params).id);
  const application = id && (await getApplication(id));
  const file = application && application.cvPath && resolveCvPath(application.cvPath);
  if (!file) return notFound();
  try {
    const data = await readFile(file);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`,
      },
    });
  } catch {
    return NextResponse.json({ error: `Arquivo não encontrado: ${application.cvPath}` }, { status: 404 });
  }
}
