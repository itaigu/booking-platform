import Link from "next/link";
import type { Lang, T } from "@/lib/i18n";
import { addDays, fmtDayShort, fmtLongDate, fmtWeekRange, todayLocal, weekStartOf } from "@/lib/format";
import { DateJump } from "./date-jump";

// Calendar header: Today, ‹ ›, the date (tap to pick another) and the Day/Week switch.
export function CalendarToolbar({ date, week, lang, t }: { date: string; week: boolean; lang: Lang; t: T }) {
  const q = (d: string, v = week) => `/calendar?date=${d}${v ? "&view=week" : ""}`;
  const step = week ? 7 : 1;
  const weekStart = weekStartOf(date);
  const weekEnd = addDays(weekStart, 6);
  const seg = (on: boolean) =>
    `inline-flex items-center rounded-md px-3 text-sm font-medium ${on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`;
  const arrow = "grid w-11 place-items-center text-slate-600 hover:bg-slate-50 focus-visible:-outline-offset-2 sm:w-9";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Link
        href={q(todayLocal())}
        className="inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:h-9"
      >
        {t("today")}
      </Link>
      <div className="inline-flex h-11 overflow-hidden rounded-md border border-slate-300 bg-white sm:h-9">
        <Link href={q(addDays(date, -step))} aria-label={t(week ? "prevWeek" : "prevDay")} title={t(week ? "prevWeek" : "prevDay")} className={arrow}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <Link href={q(addDays(date, step))} aria-label={t(week ? "nextWeek" : "nextDay")} title={t(week ? "nextWeek" : "nextDay")} className={`${arrow} border-l border-slate-300`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>
      <DateJump
        key={`${date}-${week}`}
        date={date}
        week={week}
        label={week ? fmtWeekRange(weekStart, weekEnd, lang) : fmtLongDate(date, lang)}
        shortLabel={week ? fmtWeekRange(weekStart, weekEnd, lang, false) : fmtDayShort(date, lang)}
        ariaLabel={t("chooseDate")}
      />
      <div role="group" aria-label={t("view")} className="ml-auto inline-flex h-11 rounded-lg bg-slate-100 p-0.5 sm:h-9">
        <Link href={q(date, false)} aria-current={!week ? "page" : undefined} className={seg(!week)}>{t("dayView")}</Link>
        <Link href={q(date, true)} aria-current={week ? "page" : undefined} className={seg(week)}>{t("weekView")}</Link>
      </div>
    </div>
  );
}
