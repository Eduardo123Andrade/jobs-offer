// Progress of a CV tailoring run, streamed from the API to the page (one JSON per line).
// Kept free of server-only imports so the client component can use the types and labels.

export type CvProgress =
  | { step: "analyze" }
  | { step: "ai"; model: string; attempt: number }
  | { step: "ai-failed"; model: string; reason: string }
  | { step: "validate" }
  | { step: "invalid-json" }
  | { step: "rejected"; violations: string[] }
  | { step: "pdf" }
  | { step: "done" };

export type CvStreamLine =
  | { type: "progress"; event: CvProgress; elapsedMs: number }
  | { type: "done" }
  | { type: "error"; error: string; violations?: string[] };

export function progressLabel(e: CvProgress): string {
  switch (e.step) {
    case "analyze":
      return "Comparando a vaga com o seu CV";
    case "ai":
      return `${e.attempt > 1 ? "Nova tentativa: pedindo" : "Pedindo"} ao Gemini (modelo ${e.model})…`;
    case "ai-failed":
      return `Modelo ${e.model} falhou: ${e.reason}`;
    case "validate":
      return "Verificando se a IA inventou algo";
    case "invalid-json":
      return "Resposta da IA ilegível, tentando de novo";
    case "rejected":
      return `IA tentou incluir ${e.violations.length} informação(ões) que não estão no seu CV, tentando de novo`;
    case "pdf":
      return "Gerando e salvando o PDF";
    case "done":
      return "Pronto";
  }
}
