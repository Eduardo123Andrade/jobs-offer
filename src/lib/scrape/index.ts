import "server-only";
import * as cheerio from "cheerio";
import type { WorkModel } from "@/lib/constants";
import { bulletize, detectWorkModel, extractResponsibilities, extractTechnologies, htmlToText } from "./extract";

export type ScrapedJob = {
  platform?: string;
  company?: string;
  role?: string;
  location?: string;
  workModel?: WorkModel;
  salary?: string;
  description?: string;
  responsibilities?: string;
  technologies?: string[];
};

export type ScrapeResult = { data: ScrapedJob; source: "linkedin" | "gupy" | "json-ld" | "meta" | "url-only"; warning?: string };

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
};
const TIMEOUT_MS = 8000;

const PLATFORMS: [RegExp, string][] = [
  [/linkedin\.com$/, "LinkedIn"],
  [/gupy\.io$/, "Gupy"],
  [/indeed\.com/, "Indeed"],
  [/glassdoor\./, "Glassdoor"],
  [/greenhouse\.io$/, "Greenhouse"],
  [/lever\.co$/, "Lever"],
  [/workable\.com$/, "Workable"],
  [/programathor\.com\.br$/, "ProgramaThor"],
  [/trampos\.co$/, "Trampos"],
  [/catho\.com\.br$/, "Catho"],
  [/vagas\.com\.br$/, "Vagas.com"],
  [/remotar\.com\.br$/, "Remotar"],
  [/solides\.com\.br$/, "Sólides"],
  [/inhire\.app$/, "InHire"],
  [/kenoby\.com$/, "Kenoby"],
];

export function platformFromUrl(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  return PLATFORMS.find(([re]) => re.test(host))?.[1] ?? "Site da empresa";
}

async function fetchText(url: string) {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url };
}

/** Fills responsibilities/technologies from the description when the source didn't provide them. */
function enrich(data: ScrapedJob, extraText = ""): ScrapedJob {
  const text = [data.description, data.responsibilities, extraText].filter(Boolean).join("\n");
  if (!data.responsibilities && data.description) data.responsibilities = extractResponsibilities(data.description) ?? undefined;
  if (!data.technologies?.length) data.technologies = extractTechnologies(text);
  if (!data.workModel) data.workModel = detectWorkModel([data.role, data.location].filter(Boolean).join(" ")) ?? undefined;
  return clean(data);
}

/** Drops empty values so the client only fills what was actually found. */
function clean(data: ScrapedJob): ScrapedJob {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "")),
  ) as ScrapedJob;
}

// ---------- LinkedIn ----------

function linkedInJobId(url: URL) {
  return url.searchParams.get("currentJobId") ?? url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/)?.[1] ?? null;
}

async function scrapeLinkedIn(url: URL): Promise<ScrapedJob | null> {
  const id = linkedInJobId(url);
  if (!id) return null;
  // Public "guest" endpoint: same data as the job page, no login wall, much smaller payload.
  const { html } = await fetchText(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`);
  const $ = cheerio.load(html);
  const text = (sel: string) => $(sel).first().text().replace(/\s+/g, " ").trim() || undefined;
  const descriptionHtml = $(".show-more-less-html__markup").first().html();
  const salary = text(".compensation__salary");
  return {
    role: text(".top-card-layout__title, .topcard__title"),
    company: text(".topcard__org-name-link, .topcard__flavor a"),
    location: text(".topcard__flavor--bullet"),
    salary,
    description: descriptionHtml ? htmlToText(descriptionHtml) : undefined,
  };
}

// ---------- Gupy ----------

type GupyJob = {
  name?: string;
  description?: string;
  responsibilities?: string;
  prerequisites?: string;
  workplaceType?: string;
  addressCity?: string;
  addressStateShortName?: string;
  careerPage?: { name?: string };
  company?: { name?: string };
};

const GUPY_WORKPLACE: Record<string, WorkModel> = { remote: "remote", hybrid: "hybrid", "on-site": "onsite" };

function scrapeGupy(html: string): { data: ScrapedJob; prerequisites: string } | null {
  const raw = cheerio.load(html)("#__NEXT_DATA__").text();
  if (!raw) return null;
  const job: GupyJob | undefined = JSON.parse(raw)?.props?.pageProps?.job;
  if (!job) return null;

  const description = [job.description, job.responsibilities, job.prerequisites]
    .filter(Boolean)
    .map((h) => htmlToText(h!))
    .join("\n\n");
  const workModel = job.workplaceType ? GUPY_WORKPLACE[job.workplaceType] : undefined;
  return {
    data: {
      role: job.name?.replace(/\s*·\s*$/, "").trim(),
      company: job.careerPage?.name ?? job.company?.name,
      location:
        workModel === "remote" && !job.addressCity
          ? "Remoto"
          : [job.addressCity, job.addressStateShortName].filter(Boolean).join(", ") || undefined,
      workModel,
      description,
      responsibilities: job.responsibilities ? (bulletize(htmlToText(job.responsibilities)) ?? undefined) : undefined,
    },
    prerequisites: job.prerequisites ? htmlToText(job.prerequisites) : "",
  };
}

// ---------- generic: JSON-LD JobPosting, then Open Graph ----------

type JsonLdPosting = {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: JsonLdPlace | JsonLdPlace[];
  jobLocationType?: string;
  baseSalary?: { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } };
};
type JsonLdPlace = { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } };

function findJobPosting(node: unknown): JsonLdPosting | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findJobPosting(n);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj as JsonLdPosting;
  return findJobPosting(obj["@graph"]);
}

function formatSalary(s: JsonLdPosting["baseSalary"]) {
  const v = s?.value;
  if (!v) return undefined;
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const cur = s?.currency === "BRL" || !s?.currency ? "R$" : s.currency;
  const range = v.minValue && v.maxValue ? `${fmt(v.minValue)} – ${fmt(v.maxValue)}` : v.value ?? v.minValue ?? v.maxValue;
  if (!range) return undefined;
  const unit = { MONTH: "/mês", YEAR: "/ano", HOUR: "/hora" }[v.unitText ?? ""] ?? "";
  return `${cur} ${typeof range === "number" ? fmt(range) : range}${unit}`;
}

function scrapeJsonLd($: cheerio.CheerioAPI): ScrapedJob | null {
  let posting: JsonLdPosting | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (posting) return;
    try {
      posting = findJobPosting(JSON.parse($(el).text()));
    } catch {
      // Malformed JSON-LD is common; ignore the block.
    }
  });
  if (!posting) return null;
  const p = posting as JsonLdPosting;
  const place = Array.isArray(p.jobLocation) ? p.jobLocation[0] : p.jobLocation;
  const addr = place?.address;
  const remote = p.jobLocationType === "TELECOMMUTE";
  return {
    role: p.title,
    company: typeof p.hiringOrganization === "string" ? p.hiringOrganization : p.hiringOrganization?.name,
    location: remote && !addr?.addressLocality ? "Remoto" : [addr?.addressLocality, addr?.addressRegion].filter(Boolean).join(", ") || undefined,
    workModel: remote ? "remote" : undefined,
    salary: formatSalary(p.baseSalary),
    description: p.description ? htmlToText(p.description) : undefined,
  };
}

function scrapeMeta($: cheerio.CheerioAPI): ScrapedJob | null {
  const meta = (prop: string) => $(`meta[property="${prop}"], meta[name="${prop}"]`).attr("content")?.trim() || undefined;
  // Only og:title: a plain <title> is usually the site name, not the job.
  const title = meta("og:title");
  const description = meta("og:description") ?? meta("description");
  if (!title && !description) return null;
  return { role: title, company: meta("og:site_name"), description };
}

// ---------- entry point ----------

export async function scrapeJob(rawUrl: string): Promise<ScrapeResult> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("URL deve ser http(s)");
  const platform = platformFromUrl(url);
  const base: ScrapedJob = { platform };

  try {
    if (platform === "LinkedIn") {
      const li = await scrapeLinkedIn(url);
      if (li) return { data: enrich({ ...base, ...li }), source: "linkedin" };
    }

    const { html } = await fetchText(url.toString());

    if (platform === "Gupy") {
      const gupy = scrapeGupy(html);
      if (gupy) return { data: enrich({ ...base, ...gupy.data }, gupy.prerequisites), source: "gupy" };
    }

    const $ = cheerio.load(html);
    const ld = scrapeJsonLd($);
    if (ld) return { data: enrich({ ...base, ...ld }), source: "json-ld" };

    const meta = scrapeMeta($);
    if (meta) return { data: enrich({ ...base, ...meta }), source: "meta" };

    return { data: base, source: "url-only", warning: "Página sem dados da vaga reconhecíveis." };
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "tempo esgotado" : err instanceof Error ? err.message : "erro";
    return { data: base, source: "url-only", warning: `Não foi possível ler a página (${reason}).` };
  }
}
