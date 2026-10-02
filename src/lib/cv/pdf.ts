import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { marked } from "marked";

/** Markdown → HTML. Raw HTML in the markdown is escaped, since part of it comes from an AI. */
export function cvToHtml(md: string) {
  return marked.parse(md.replace(/</g, "&lt;"), { async: false });
}

// Same single-column layout as the original CV (build-pdf.js): ATS parsers read it top to bottom.
const STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5px; line-height: 1.4; color: #1a1a1a; padding: 16px 24px; max-width: 860px; margin: 0 auto; text-align: justify; }
  h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 0; }
  h1 + p { font-size: 11.5px; color: #475569; margin-bottom: 3px; font-weight: 500; }
  h1 + p + p { font-size: 9.5px; color: #64748b; margin-bottom: 10px; }
  h2 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; border-bottom: 1.5px solid #0f172a; padding-bottom: 2px; margin-top: 12px; margin-bottom: 6px; }
  h3 { font-size: 10px; font-weight: 700; color: #0f172a; margin-top: 7px; margin-bottom: 1px; }
  h3 + p em { font-size: 9px; color: #64748b; font-style: normal; }
  p { margin-bottom: 3px; font-size: 9.5px; }
  ul { padding-left: 14px; margin-bottom: 3px; }
  li { margin-bottom: 2px; font-size: 9.5px; line-height: 1.4; }
  strong { font-weight: 600; color: #0f172a; }
  a { color: #2563eb; text-decoration: none; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 8px 0; }
  h2 + p, h2 + p + p, h2 + p + p + p { font-size: 9.5px; margin-bottom: 2px; }
  p > strong:only-child { display: inline-block; font-size: 9.5px; color: #1e293b; margin-top: 4px; }
`;

export function cvDocument(md: string, lang: string) {
  return `<!DOCTYPE html><html lang="${lang === "pt" ? "pt-BR" : "en"}"><head><meta charset="UTF-8"><style>${STYLE}</style></head><body>${cvToHtml(md)}</body></html>`;
}

/**
 * Renders with wkhtmltopdf (same tool as the original CV), HTML via stdin. Output goes to a temp file:
 * some wkhtmltopdf builds can't paint to stdout ("QPainter::begin(): Returned false").
 */
export async function renderPdf(html: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "jobs-offer-pdf-"));
  const out = path.join(dir, "cv.pdf");
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.env.WKHTMLTOPDF_BIN ?? "wkhtmltopdf", ["--quiet", "--encoding", "utf-8", "-s", "A4", "-", out]);
      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d));
      child.on("error", (err) =>
        reject((err as NodeJS.ErrnoException).code === "ENOENT" ? new Error("wkhtmltopdf não encontrado no PATH.") : err),
      );
      child.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`wkhtmltopdf falhou (código ${code}): ${stderr.trim().slice(-300)}`)),
      );
      child.stdin.end(html);
    });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
