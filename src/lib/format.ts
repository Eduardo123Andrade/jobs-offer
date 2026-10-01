import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const formatDate = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");

export const formatShortDate = (iso: string) => format(parseISO(iso), "dd/MM", { locale: ptBR });

export const timeAgo = (date: Date | string) =>
  formatDistanceToNowStrict(typeof date === "string" ? parseISO(date) : date, { locale: ptBR, addSuffix: true });

export const percent = (v: number) => `${Math.round(v * 100)}%`;

export function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
