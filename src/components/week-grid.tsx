import Link from "next/link";
import type { Lang, T } from "@/lib/i18n";
import { colorOf } from "@/lib/colors";
import { addDays, cap, dayStart, fmtClock, fmtTime, localDayOf, localMinutes, TZ, todayLocal } from "@/lib/format";
import { tripLoad, tripPill } from "@/lib/trip-status";
import type { Availability } from "@/lib/types";
import { FillBar, Pill, type Block, type Boat } from "./day-grid";

const HOUR_PX = 48;

// Seven days, Monday to Sunday. On a computer: a grid with hour lines where
// trips only sit side by side when their times overlap. On a phone: a list per day.
export function WeekGrid({
  boats,
  trips,
  blocks,
  weekStart,
  lang,
  t,
}: {
  boats: Boat[];
  trips: Availability[];
  blocks: Block[];
  weekStart: string;
  lang: Lang;
  t: T;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const lanes = boats.filter((b) => trips.some((tr) => tr.boat_id === b.id));
  const boatOf = (id: number) => boats.find((b) => b.id === id);
  const today = todayLocal();
  const locale = lang === "es" ? "es-MX" : "en-US";
  const weekdayFmt = new Intl.DateTimeFormat(locale, { timeZone: TZ, weekday: "short" });
  const longDayFmt = new Intl.DateTimeFormat(locale, { timeZone: TZ, weekday: "long", day: "numeric", month: "short" });

  const tripsOn = (day: string) =>
    trips
      .filter((tr) => localDayOf(tr.starts_at) === day)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const paxOn = (list: Availability[]) =>
    list.filter((tr) => tr.status === "scheduled").reduce((n, tr) => n + tr.guests_booked, 0);
  const startMin = (tr: Availability) => localMinutes(tr.starts_at);
  const endMin = (tr: Availability, day: string) =>
    localDayOf(tr.ends_at) > day ? 24 * 60 : localMinutes(tr.ends_at);

  // Same hour range for every day: 7 a.m.–9 p.m., stretched to fit any trip.
  let firstHour = 7;
  let lastHour = 21;
  for (const tr of trips) {
    const d = localDayOf(tr.starts_at);
    firstHour = Math.min(firstHour, Math.floor(startMin(tr) / 60));
    lastHour = Math.max(lastHour, Math.ceil(endMin(tr, d) / 60));
  }
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const top = (min: number) => ((min - firstHour * 60) / 60) * HOUR_PX;
  const clamp = (min: number) => Math.min(Math.max(min, firstHour * 60), lastHour * 60);
  const nowMin = localMinutes(new Date().toISOString());

  // Trips whose times overlap form a group and share the day's width, one
  // slot per boat (in boat order). A trip with nothing beside it gets the full width.
  const layout = (list: Availability[], day: string) => {
    const pos = new Map<number, { lane: number; cols: number }>();
    let group: Availability[] = [];
    let groupEnd = -1;
    const flush = () => {
      const groupBoats = lanes.filter((b) => group.some((g) => g.boat_id === b.id));
      for (const g of group) {
        pos.set(g.id, {
          lane: Math.max(groupBoats.findIndex((b) => b.id === g.boat_id), 0),
          cols: Math.max(groupBoats.length, 1),
        });
      }
      group = [];
      groupEnd = -1;
    };
    for (const tr of list) {
      if (group.length && startMin(tr) >= groupEnd) flush();
      group.push(tr);
      groupEnd = Math.max(groupEnd, endMin(tr, day));
    }
    flush();
    return pos;
  };

  return (
    <>
      {/* Phone: one list per day */}
      <div className="flex flex-col gap-3 md:hidden">
        {days.map((day) => {
          const list = tripsOn(day);
          const pax = paxOn(list);
          return (
            <section key={day} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <Link
                href={`/calendar?date=${day}`}
                className={`flex min-h-11 items-center justify-between px-3 text-sm font-semibold ${
                  day === today ? "bg-sky-50 text-sky-900" : "bg-slate-50 text-slate-700"
                }`}
              >
                <span>{cap(longDayFmt.format(new Date(dayStart(day))))}</span>
                <span className="text-xs font-medium text-slate-500">{pax ? `${pax} pax` : ""}</span>
              </Link>
              {list.length === 0 ? (
                <p className="border-t border-slate-100 px-3 py-2.5 text-sm text-slate-500">{t("noTrips")}</p>
              ) : (
                list.map((tr) => {
                  const cancelled = tr.status !== "scheduled";
                  const name = lang === "es" ? tr.product_name_es : tr.product_name_en;
                  return (
                    <Link
                      key={tr.id}
                      href={`/departures/${tr.id}?view=week`}
                      className="flex min-h-14 items-center gap-3 border-t border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="w-16 shrink-0 text-xs font-semibold text-slate-900 tabular-nums">
                        {fmtTime(tr.starts_at, lang)}
                      </span>
                      <span
                        className={`h-9 w-1 shrink-0 rounded-full ${cancelled ? "bg-slate-300" : colorOf(boatOf(tr.boat_id)?.color).dot}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-medium ${cancelled ? "text-slate-500 line-through" : "text-slate-900"}`}>
                          {name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{tr.boat_name}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-slate-700 tabular-nums">
                        {!cancelled && tripLoad(tr, t)}
                        <Pill pill={tripPill(tr, true)} t={t} />
                      </span>
                    </Link>
                  );
                })
              )}
            </section>
          );
        })}
      </div>

      {/* Computer: the week grid */}
      <div className="relative hidden max-h-[calc(100dvh-8rem)] overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        {lanes.length > 1 && (
          <div className="sticky left-0 flex flex-wrap gap-3 border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
            {lanes.map((b) => (
              <span key={b.id} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${colorOf(b.color).dot}`} /> {b.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex min-w-[56rem]">
          {/* Hour labels */}
          <div className="sticky left-0 z-40 w-14 shrink-0 border-r border-slate-200 bg-white sm:w-16">
            <div className="sticky top-0 z-10 h-16 border-b border-slate-200 bg-white" />
            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className={`absolute right-2 whitespace-nowrap text-xs text-slate-500 ${h === firstHour ? "translate-y-1" : "-translate-y-2"}`}
                  style={{ top: top(h * 60) }}
                >
                  {fmtClock(h * 60, lang, true)}
                </div>
              ))}
            </div>
          </div>

          {days.map((day) => {
            const list = tripsOn(day);
            const pos = layout(list, day);
            const pax = paxOn(list);
            const isToday = day === today;
            const dayBlocks = blocks.filter((bl) => localDayOf(bl.starts_at) <= day && localDayOf(bl.ends_at) >= day);
            return (
              <div key={day} className="min-w-0 flex-1 border-r border-slate-200 last:border-r-0">
                <Link
                  href={`/calendar?date=${day}`}
                  title={t("viewDay")}
                  className="sticky top-0 z-30 flex h-16 flex-col items-center justify-center gap-0.5 border-b border-slate-200 bg-white hover:bg-slate-50"
                >
                  <span className={`text-[11px] font-medium uppercase ${isToday ? "text-sky-700" : "text-slate-500"}`}>
                    {weekdayFmt.format(new Date(dayStart(day)))}
                  </span>
                  <span
                    className={`grid h-7 min-w-7 place-items-center rounded-full px-1 text-base font-semibold tabular-nums ${
                      isToday ? "bg-sky-700 text-white" : "text-slate-900"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <span className="text-[10px] text-slate-500">{pax ? `${pax} pax` : " "}</span>
                </Link>
                <div
                  className={`relative ${isToday ? "bg-sky-50/40" : ""}`}
                  style={{ height: hours.length * HOUR_PX }}
                >
                  {hours.map((h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-slate-200" style={{ top: top(h * 60) }} />
                  ))}

                  {dayBlocks.map((bl) => {
                    const from = clamp(localDayOf(bl.starts_at) < day ? 0 : localMinutes(bl.starts_at));
                    const to = clamp(localDayOf(bl.ends_at) > day ? 24 * 60 : localMinutes(bl.ends_at));
                    if (to <= from) return null;
                    return (
                      <div
                        key={bl.id}
                        title={bl.reason}
                        className="absolute inset-x-0.5 z-[3] overflow-hidden rounded border border-slate-300 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_12px)] px-1 py-0.5 text-[10px] leading-tight text-slate-600"
                        style={{ top: top(from), height: top(to) - top(from) }}
                      >
                        <div className="truncate font-semibold">
                          {bl.boat_id === null ? t("allBoats") : (boatOf(bl.boat_id)?.name ?? "")}
                        </div>
                        <div className="truncate">
                          {t("blocked")} · {bl.reason}
                        </div>
                      </div>
                    );
                  })}

                  {list.map((tr) => {
                    const { lane, cols } = pos.get(tr.id) ?? { lane: 0, cols: 1 };
                    const start = clamp(startMin(tr));
                    const end = clamp(endMin(tr, day));
                    const cancelled = tr.status !== "scheduled";
                    const name = lang === "es" ? tr.product_name_es : tr.product_name_en;
                    const pill = tripPill(tr, true);
                    // Side by side with another trip: shorter time and text that wraps.
                    const narrow = cols > 1;
                    return (
                      <Link
                        key={tr.id}
                        href={`/departures/${tr.id}?view=week`}
                        title={`${fmtTime(tr.starts_at, lang)}–${fmtTime(tr.ends_at, lang)} · ${name} · ${tr.boat_name} · ${tripLoad(tr, t)}${pill ? ` · ${t(pill.key)}` : ""}`}
                        className={`absolute flex flex-col gap-0.5 overflow-hidden rounded border-l-4 py-1 text-[11px] ${narrow ? "px-1" : "px-1.5"} leading-tight shadow-sm hover:brightness-95 focus-visible:z-20 ${
                          cancelled ? "z-[4] border-slate-300 bg-slate-100 text-slate-500" : `z-[5] ${colorOf(boatOf(tr.boat_id)?.color).box}`
                        }`}
                        style={{
                          top: top(start),
                          height: Math.max(top(end) - top(start), 36),
                          left: `calc(${(lane * 100) / cols}% + 1px)`,
                          width: `calc(${100 / cols}% - 2px)`,
                        }}
                      >
                        <span className="font-semibold whitespace-nowrap tabular-nums">
                          {narrow ? fmtClock(startMin(tr), lang).split(" ")[0] : fmtTime(tr.starts_at, lang)}
                        </span>
                        <span
                          className={`font-medium ${narrow ? "line-clamp-3 [overflow-wrap:anywhere]" : "truncate"} ${cancelled ? "line-through" : ""}`}
                        >
                          {name}
                        </span>
                        <span className="flex flex-wrap items-center gap-1 tabular-nums">
                          {!cancelled && (
                            <span className="truncate">
                              {narrow && tr.kind === "shared" ? `${tr.guests_booked}/${tr.capacity}` : tripLoad(tr, t)}
                            </span>
                          )}
                          <Pill pill={pill} t={t} />
                        </span>
                        <FillBar trip={tr} />
                      </Link>
                    );
                  })}

                  {isToday && nowMin >= firstHour * 60 && nowMin <= lastHour * 60 && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500"
                      style={{ top: top(nowMin) }}
                    >
                      <span className="absolute -top-[5px] -left-1 h-2 w-2 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
