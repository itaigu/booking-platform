import Link from "next/link";
import type { Lang, T } from "@/lib/i18n";
import { colorOf } from "@/lib/colors";
import { addDays, dayStart, fmtTime, localDayOf, localMinutes, todayLocal } from "@/lib/format";
import type { Availability } from "@/lib/types";
import type { Boat } from "./day-grid";

const HOUR_PX = 48;
const hhmm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

// Seven days side by side with hour lines. Inside each day, every boat with a
// trip this week gets its own narrow lane, in the boat's color.
export function WeekGrid({
  boats,
  trips,
  weekStart,
  lang,
  t,
}: {
  boats: Boat[];
  trips: Availability[];
  weekStart: string;
  lang: Lang;
  t: T;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const lanes = boats.filter((b) => trips.some((tr) => tr.boat_id === b.id));

  // Same hour range for every day: 7:00–21:00, stretched to fit any trip.
  let firstHour = 7;
  let lastHour = 21;
  for (const tr of trips) {
    const d = localDayOf(tr.starts_at);
    firstHour = Math.min(firstHour, Math.floor(localMinutes(tr.starts_at) / 60));
    lastHour = Math.max(lastHour, localDayOf(tr.ends_at) > d ? 24 : Math.ceil(localMinutes(tr.ends_at) / 60));
  }
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const top = (min: number) => ((min - firstHour * 60) / 60) * HOUR_PX;
  const today = todayLocal();
  const dayFmt = new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    timeZone: "America/Mazatlan",
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      {lanes.length > 1 && (
        <div className="flex flex-wrap gap-3 border-b border-slate-200 px-3 py-2 text-xs">
          {lanes.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <span className={`h-3 w-3 rounded-sm ${colorOf(b.color).dot}`} /> {b.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex min-w-[56rem]">
        {/* Hour labels */}
        <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-slate-200 bg-white">
          <div className="h-10 border-b border-slate-200" />
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-2 text-xs text-slate-500" style={{ top: top(h * 60) }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {days.map((day) => {
          const dayTrips = trips.filter((tr) => localDayOf(tr.starts_at) === day);
          // Lanes for the boats sailing that day, so a quiet day gets wide boxes.
          const dayLanes = lanes.filter((b) => dayTrips.some((tr) => tr.boat_id === b.id));
          return (
            <div key={day} className="min-w-0 flex-1 border-r border-slate-200 last:border-r-0">
              <Link
                href={`/calendar?date=${day}`}
                title={t("viewDay")}
                className={`flex h-10 items-center justify-center text-xs font-semibold uppercase hover:bg-slate-50 ${
                  day === today ? "bg-sky-50 text-sky-800" : "text-slate-700"
                }`}
              >
                {dayFmt.format(new Date(dayStart(day)))}
              </Link>
              <div className="relative" style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-slate-200" style={{ top: top(h * 60) }} />
                ))}
                {dayTrips.map((tr) => {
                  const lane = Math.max(dayLanes.findIndex((b) => b.id === tr.boat_id), 0);
                  const width = 100 / Math.max(dayLanes.length, 1);
                  const start = localMinutes(tr.starts_at);
                  const end = localDayOf(tr.ends_at) > day ? 24 * 60 : localMinutes(tr.ends_at);
                  const cancelled = tr.status !== "scheduled";
                  const boat = dayLanes[lane];
                  const name = lang === "es" ? tr.product_name_es : tr.product_name_en;
                  const seats =
                    tr.kind === "private"
                      ? tr.bookings_count > 0 ? t("full") : t("available")
                      : tr.seats_left === 0 ? t("full") : `${tr.seats_left} ${t("seatsLeftShort")}`;
                  return (
                    <Link
                      key={tr.id}
                      href={`/departures/${tr.id}`}
                      title={`${fmtTime(tr.starts_at, lang)} ${name} · ${boat?.name ?? ""}`}
                      className={`absolute z-[5] overflow-hidden rounded border-l-4 px-1 py-0.5 text-[11px] leading-tight shadow-sm hover:brightness-95 ${
                        colorOf(boat?.color).box
                      } ${cancelled ? "opacity-50 line-through" : ""}`}
                      style={{
                        top: top(start),
                        height: Math.max(top(end) - top(start), 32),
                        left: `calc(${lane * width}% + 1px)`,
                        width: `calc(${width}% - 2px)`,
                      }}
                    >
                      <div className="font-semibold">{hhmm(start)}</div>
                      <div className="truncate">{name}</div>
                      <div className="truncate font-medium">{seats}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
