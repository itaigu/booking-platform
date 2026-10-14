import type { Lang } from "./i18n";

// Cabo San Lucas is on fixed UTC-7 all year (no daylight saving).
export const TZ = "America/Mazatlan";
export const TZ_OFFSET = "-07:00";

export function fmtDate(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function fmtTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function fmtDateTime(iso: string, lang: Lang) {
  return `${fmtDate(iso, lang)} · ${fmtTime(iso, lang)}`;
}

export function fmtMoney(n: number | string | null) {
  if (n === null || n === undefined || n === "") return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));
}

// Today's date in Cabo, as YYYY-MM-DD.
export function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Start of a Cabo calendar day as a timestamp.
export function dayStart(day: string) {
  return `${day}T00:00:00${TZ_OFFSET}`;
}

export function isDay(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// The Cabo calendar day (YYYY-MM-DD) a timestamp falls on.
export function localDayOf(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

// Minutes since midnight in Cabo for a timestamp, e.g. 17:30 → 1050.
export function localMinutes(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

export function fmtLongDate(day: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dayStart(day)));
}
