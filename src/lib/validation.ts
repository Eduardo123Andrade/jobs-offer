import { z } from "zod";
import { STATUSES, WORK_MODELS } from "./constants";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullish();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)");

export const applicationInput = z.object({
  url: z.url("Link da vaga inválido").trim(),
  platform: z.string().trim().min(1, "Informe a plataforma"),
  status: z.enum(STATUSES).default("applied"),
  appliedAt: isoDate,
  company: optionalText,
  role: optionalText,
  location: optionalText,
  workModel: z.enum(WORK_MODELS).nullish().or(z.literal("").transform(() => null)),
  salary: optionalText,
  contactName: optionalText,
  contactEmail: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("E-mail inválido").nullable())
    .nullish(),
  notes: optionalText,
  cvPath: optionalText,
  description: optionalText,
  responsibilities: optionalText,
  // Accepts an array or the form's comma-separated string.
  technologies: z
    .union([z.array(z.string()), z.string()])
    .transform((v) => [...new Set((typeof v === "string" ? v.split(",") : v).map((t) => t.trim()).filter(Boolean))])
    .optional(),
  followUpAt: isoDate.nullish().or(z.literal("").transform(() => null)),
});

export const applicationPatch = applicationInput.partial();

export type ApplicationInput = z.infer<typeof applicationInput>;

export const filtersSchema = z.object({
  status: z.array(z.enum(STATUSES)).default([]),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  location: z.string().trim().optional(),
  platform: z.string().trim().optional(),
  workModel: z.enum(WORK_MODELS).optional().catch(undefined),
  q: z.string().trim().optional(),
  followUp: z.enum(["due", "stale"]).optional().catch(undefined),
});

export type Filters = z.infer<typeof filtersSchema>;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

/** Parses filters from either URLSearchParams (API) or Next's searchParams object (pages). */
export function parseFilters(source: ParamSource): Filters {
  const get = (key: string): string[] => {
    const raw = source instanceof URLSearchParams ? source.getAll(key) : source[key];
    const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    return values.flatMap((v) => v.split(",")).filter(Boolean);
  };
  const first = (key: string) => get(key)[0] || undefined;

  const result = filtersSchema.safeParse({
    status: get("status").filter((s) => (STATUSES as readonly string[]).includes(s)),
    from: first("from"),
    to: first("to"),
    location: first("location"),
    platform: first("platform"),
    workModel: first("workModel"),
    q: first("q"),
    followUp: first("followUp"),
  });
  return result.success ? result.data : filtersSchema.parse({});
}

const profileNoteFields = { title: z.string().trim().max(200), content: z.string(), useInCv: z.boolean() };

export const profileNoteInput = z.object({
  title: profileNoteFields.title.default(""),
  content: profileNoteFields.content.default(""),
  useInCv: profileNoteFields.useInCv.default(true),
});

// Built without defaults: .partial() would still fill omitted fields with "" and wipe them.
export const profileNotePatch = z.object(profileNoteFields).partial();

export type ProfileNoteInput = z.infer<typeof profileNoteInput>;
