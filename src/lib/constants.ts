export const STATUSES = [
  "saved",
  "applied",
  "in_review",
  "interview",
  "technical_test",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  saved: "Salva",
  applied: "Aplicado",
  in_review: "Em análise",
  interview: "Entrevista",
  technical_test: "Teste técnico",
  offer: "Oferta",
  rejected: "Recusado",
  withdrawn: "Desistiu",
};

export const STATUS_COLORS: Record<Status, string> = {
  saved: "#94a3b8",
  applied: "#3b82f6",
  in_review: "#8b5cf6",
  interview: "#f59e0b",
  technical_test: "#f97316",
  offer: "#22c55e",
  rejected: "#ef4444",
  withdrawn: "#64748b",
};

/** Statuses where the process is over; these never count as stale or need follow-up. */
export const CLOSED_STATUSES: Status[] = ["offer", "rejected", "withdrawn"];

/** Statuses that mean the company answered (used for the response rate). */
export const RESPONDED_STATUSES: Status[] = ["in_review", "interview", "technical_test", "offer", "rejected"];

export const WORK_MODELS = ["remote", "hybrid", "onsite"] as const;
export type WorkModel = (typeof WORK_MODELS)[number];

export const WORK_MODEL_LABELS: Record<WorkModel, string> = {
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
};

export const PLATFORM_SUGGESTIONS = ["LinkedIn", "Gupy", "Indeed", "Glassdoor", "Site da empresa", "Indicação"];

/** An open application with no status change for this many days is flagged as stale. */
export const STALE_AFTER_DAYS = 14;
