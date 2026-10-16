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

// "miércoles, 14 de octubre" → "Miércoles, 14 de octubre" (only the first letter).
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const locale = (lang: Lang) => (lang === "es" ? "es-MX" : "en-US");

export function fmtLongDate(day: string, lang: Lang) {
  return cap(
    new Intl.DateTimeFormat(locale(lang), {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(dayStart(day))),
  );
}

// "Mié 14 de oct" / "Wed, Oct 14"
export function fmtDayShort(day: string, lang: Lang) {
  return cap(
    new Intl.DateTimeFormat(locale(lang), { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(
      new Date(dayStart(day)),
    ),
  );
}

// "12–18 de oct de 2026" / "Oct 12 – 18, 2026"
export function fmtWeekRange(from: string, to: string, lang: Lang, withYear = true) {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).formatRange(new Date(dayStart(from)), new Date(dayStart(to)));
}

// Minutes since midnight as a clock time: 1050 → "5:30 p.m." ("5 p.m." when short).
// Written by hand so the server and the browser always print the same thing.
export function fmtClock(min: number, lang: Lang, short = false) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ap = h < 12 ? (lang === "es" ? "a.m." : "AM") : lang === "es" ? "p.m." : "PM";
  return `${h % 12 || 12}${short && m === 0 ? "" : `:${String(m).padStart(2, "0")}`} ${ap}`;
}

// Monday of the week a day falls in.
export function weekStartOf(day: string) {
  return addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
}

// A month as YYYY-MM.
export function isMonth(s: string | undefined): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

// The month after (or before, with n = -1) a YYYY-MM month.
export function addMonths(month: string, n: number) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

// "2026-10" → "octubre de 2026" / "October 2026".
export function fmtMonth(month: string, lang: Lang) {
  return cap(new Intl.DateTimeFormat(locale(lang), { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}-15T12:00:00Z`)));
}
