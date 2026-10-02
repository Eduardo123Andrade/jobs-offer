import * as cheerio from "cheerio";
import type { WorkModel } from "@/lib/constants";

// ---------- HTML → text ----------

/** Converts job-description HTML to plain text, keeping one line per paragraph/heading and "• " for list items. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  $("br").replaceWith("\n");
  $("li").each((_, el) => {
    $(el).prepend("\n• ").append("\n");
  });
  $("p, div, h1, h2, h3, h4, h5, h6, ul, ol, tr").each((_, el) => {
    $(el).prepend("\n").append("\n");
  });
  return $.root()
    .text()
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    // Unify hand-written bullets ("- item", "* item", "• - item") into "• item".
    .map((l) => l.replace(/^(•\s*)?[-–*·▪●]\s+/, "• "))
    .filter((l) => l && l !== "•")
    .join("\n");
}

// ---------- sections ----------

const RESPONSIBILITY_HEADINGS =
  /responsabilidades|atribui[çc][õo]es|atividades|o que (voc[êe]|vc) (vai|ir[áa]) fazer|seu dia a dia|no dia a dia|seus desafios|suas miss[õo]es|desafios da (vaga|posi[çc][ãa]o)|what you('ll| will) do|responsibilities|your (role|mission|day)|key duties/i;

const OTHER_HEADINGS =
  /requisitos|qualifica[çc][õo]es|o que (esperamos|buscamos|procuramos)|(voc[êe] )?precisa ter|diferenciais|desej[áa]vel|benef[íi]cios|sobre (n[óo]s|a empresa|a vaga|o time)|quem somos|informa[çc][õo]es adicionais|etapas do processo|local de trabalho|requirements|qualifications|nice to have|bonus points|benefits|perks|about (us|the company)|who you are|what we('re| are) looking for/i;

const isHeading = (line: string) => !line.startsWith("•") && line.length <= 90 && (line.endsWith(":") || line.split(" ").length <= 8);

/**
 * Pulls the bullet list under a "Responsabilidades"-like heading out of a plain-text description.
 * Returns null when no such section exists.
 */
export function extractResponsibilities(text: string, maxItems = 12): string | null {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => isHeading(l) && RESPONSIBILITY_HEADINGS.test(l));
  if (start === -1) return null;

  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (isHeading(line) && (OTHER_HEADINGS.test(line) || line.endsWith(":"))) break;
    items.push(line.startsWith("•") ? line : `• ${line}`);
    if (items.length >= maxItems) break;
  }
  return items.length ? items.join("\n") : null;
}

/** Normalizes an already-isolated responsibilities block (e.g. Gupy's own field) to "• " lines, dropping its intro. */
export function bulletize(text: string, maxItems = 12): string | null {
  const lines = text.split("\n");
  const bullets = lines.filter((l) => l.startsWith("•"));
  const items = (bullets.length ? bullets : lines.filter((l) => !isHeading(l) || !l.endsWith(":"))).map((l) =>
    l.startsWith("•") ? l : `• ${l}`,
  );
  return items.length ? items.slice(0, maxItems).join("\n") : null;
}

// ---------- technologies ----------

// [canonical name, pattern]. Patterns are matched against the full text with custom boundaries,
// since names like "C#", ".NET" and "Node.js" don't play well with \b.
const TECHS: [string, RegExp][] = [
  ["JavaScript", /javascript|\bjs\b|ecmascript/i],
  ["TypeScript", /typescript|\bts\b/i],
  ["React", /\bReact(\.?js)?\b(?!\s*Native)|\breact\.?js\b/],
  ["React Native", /react[\s-]?native/i],
  ["Next.js", /\bnext(\.?js)\b/i],
  ["Vue", /\bvue(\.?js)?\b/i],
  ["Nuxt", /\bnuxt/i],
  ["Angular", /\bangular(js)?\b/i],
  ["Svelte", /\bsvelte/i],
  ["Redux", /\bredux\b/i],
  ["HTML", /\bhtml5?\b/i],
  ["CSS", /\bcss3?\b/i],
  ["Sass", /\bsass\b|\bscss\b/i],
  ["Tailwind", /tailwind/i],
  ["Styled Components", /styled[\s-]?components/i],
  ["Storybook", /storybook/i],
  ["Webpack", /webpack/i],
  ["Vite", /\bvite\b/i],
  ["Node.js", /\bnode(\.?js)?\b/i],
  ["Express", /\bexpress\.?js\b|\bExpress\b(?=\s?[,/)])|(?<=[,/(]\s?)Express\b/i],
  ["NestJS", /\bnest(\.?js)\b/i],
  ["Deno", /\bdeno\b/i],
  ["Python", /\bpython\b/i],
  ["Django", /\bdjango\b/i],
  ["FastAPI", /fastapi/i],
  ["Flask", /\bflask\b/i],
  ["Java", /\bjava\b(?!\s*script)/i],
  ["Spring", /\bspring(\s?boot)?\b/i],
  ["Kotlin", /\bkotlin\b/i],
  ["Go", /\bgolang\b|(?<=[,/(]\s?)Go\b|\bGo(?=\s?[,/)])/],
  ["Rust", /\brust\b/i],
  ["C#", /(^|[^\w])c#/i],
  [".NET", /\.net\b|dotnet|asp\.net/i],
  ["PHP", /\bphp\b/i],
  ["Laravel", /\blaravel\b/i],
  ["Ruby", /\bruby\b/i],
  ["Rails", /\brails\b/i],
  ["Elixir", /\belixir\b/i],
  ["Scala", /\bscala\b/i],
  ["Swift", /\bswift\b/i],
  ["Flutter", /\bflutter\b/i],
  ["Dart", /\bdart\b/i],
  ["SQL", /\bsql\b/i],
  ["PostgreSQL", /postgres(ql)?/i],
  ["MySQL", /\bmysql\b/i],
  ["SQL Server", /sql\s?server/i],
  ["Oracle", /\boracle\b/i],
  ["MongoDB", /mongo(db)?\b/i],
  ["Redis", /\bredis\b/i],
  ["Elasticsearch", /elastic\s?search/i],
  ["DynamoDB", /dynamo\s?db/i],
  ["Firebase", /firebase/i],
  ["Supabase", /supabase/i],
  ["Prisma", /\bprisma\b/i],
  ["GraphQL", /graphql/i],
  ["REST", /\brestful\b|\brest\s?apis?\b|\bapis?\s(rest|restful)\b/i],
  ["gRPC", /\bgrpc\b/i],
  ["Kafka", /\bkafka\b/i],
  ["RabbitMQ", /rabbit\s?mq/i],
  ["AWS", /\baws\b|amazon web services/i],
  ["GCP", /\bgcp\b|google cloud/i],
  ["Azure", /\bazure\b/i],
  ["Docker", /\bdocker/i],
  ["Kubernetes", /kubernetes|\bk8s\b/i],
  ["Terraform", /terraform/i],
  ["CI/CD", /ci\s?\/\s?cd|github actions|gitlab ci|jenkins/i],
  ["Git", /\bgit\b|github|gitlab/i],
  ["Linux", /\blinux\b/i],
  ["Jest", /\bjest\b/i],
  ["Vitest", /vitest/i],
  ["Testing Library", /testing[\s-]library/i],
  ["Cypress", /cypress/i],
  ["Playwright", /playwright/i],
  ["Microsserviços", /micro\s?-?servi[çc]os|microservices/i],
  ["Datadog", /datadog/i],
  ["Grafana", /grafana/i],
  ["Figma", /\bfigma\b/i],
  ["LLM / IA", /\bllms?\b|openai|langchain|\bgenai\b/i],
];

export function extractTechnologies(text: string): string[] {
  return TECHS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

// ---------- work model ----------

export function detectWorkModel(text: string): WorkModel | null {
  if (/h[íi]brido|hybrid/i.test(text)) return "hybrid";
  if (/remot[oe]|home[\s-]?office|anywhere|100% remote/i.test(text)) return "remote";
  if (/presencial|on[\s-]?site/i.test(text)) return "onsite";
  return null;
}
