import Link from "next/link";
import type { Lang, T } from "@/lib/i18n";
import { colorOf } from "@/lib/colors";
import { fmtClock, fmtTime, localDayOf, localMinutes, todayLocal } from "@/lib/format";
import type { Availability } from "@/lib/types";
import { tripFill, tripLoad, tripPill } from "@/lib/trip-status";
import { Card } from "./ui";

const HOUR_PX = 64;

export type Boat = {
  id: number;
  name: string;
  active: boolean;
  color?: string;
};
export type Block = {
  id: number;
  boat_id: number | null;
  starts_at: string;
  ends_at: string;
  reason: string;
};

// One day of trips: hour lines down the side, one column per boat.
export function DayGrid({
  boats,
  trips,
  blocks,
  date,
  lang,
  t,
}: {
  boats: Boat[];
  trips: Availability[];
  blocks: Block[];
  date: string;
  lang: Lang;
  t: T;
}) {
  // Show 7:00–21:00, stretched if a trip starts earlier or ends later.
  const startOf = (iso: string) =>
    localDayOf(iso) < date ? 0 : localMinutes(iso);
  const endOf = (iso: string) =>
    localDayOf(iso) > date ? 24 * 60 : localMinutes(iso);
  let firstHour = 7;
  let lastHour = 21;
  for (const tr of trips) {
    firstHour = Math.min(firstHour, Math.floor(startOf(tr.starts_at) / 60));
    lastHour = Math.max(lastHour, Math.ceil(endOf(tr.ends_at) / 60));
  }
  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, i) => firstHour + i,
  );
  const top = (min: number) => ((min - firstHour * 60) / 60) * HOUR_PX;
  const clampMin = (min: number) =>
    Math.min(Math.max(min, firstHour * 60), lastHour * 60);

  const isToday = date === todayLocal();
  const nowMin = localMinutes(new Date().toISOString());
  const showNow =
    isToday && nowMin >= firstHour * 60 && nowMin <= lastHour * 60;

  return boats.length === 0 ? (
    <Card>
      <p className="text-sm text-slate-500">{t("noBoats")}</p>
    </Card>
  ) : (
    // The grid scrolls on its own so the boat names stay on top while scrolling.
    <div className="relative max-h-[calc(100dvh-8rem)] overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex min-w-full">
        {/* Hour labels */}
        <div className="sticky left-0 z-40 w-14 shrink-0 border-r border-slate-200 bg-white sm:w-16">
          <div className="sticky top-0 z-10 h-14 border-b border-slate-200 bg-white" />
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

        {/* One column per boat */}
        {boats.map((boat) => {
          const color = colorOf(boat.color);
          const boatTrips = trips.filter((tr) => tr.boat_id === boat.id);
          const live = boatTrips.filter((tr) => tr.status === "scheduled");
          const summary = live.length
            ? `${live.length} ${t(live.length === 1 ? "tripOne" : "tripMany")} · ${live.reduce((n, tr) => n + tr.guests_booked, 0)} pax`
            : t("noTrips");
          const boatBlocks = blocks.filter(
            (bl) => bl.boat_id === boat.id || bl.boat_id === null,
          );
          return (
            <div
              key={boat.id}
              className="min-w-36 flex-1 border-r border-slate-200 last:border-r-0 sm:min-w-44"
            >
              <div
                className={`sticky top-0 z-30 flex h-14 flex-col items-center justify-center border-t-4 border-b border-b-slate-200 bg-white px-2 ${color.bar}`}
              >
                <span className="max-w-full truncate text-sm font-semibold text-slate-900">{boat.name}</span>
                <span className="text-[11px] text-slate-500">{summary}</span>
              </div>
              <div
                className="relative"
                style={{ height: hours.length * HOUR_PX }}
              >
                {hours.map((h) => (
                  <div key={h}>
                    <div
                      className="absolute inset-x-0 border-t border-slate-200"
                      style={{ top: top(h * 60) }}
                    />
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-slate-100"
                      style={{ top: top(h * 60 + 30) }}
                    />
                  </div>
                ))}

                {boatBlocks.map((bl) => {
                  const from = clampMin(startOf(bl.starts_at));
                  const to = clampMin(endOf(bl.ends_at));
                  if (to <= from) return null;
                  return (
                    <div
                      key={bl.id}
                      title={bl.reason}
                      className="absolute inset-x-1 overflow-hidden rounded-md border border-slate-300 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_12px)] p-1 text-xs text-slate-600"
                      style={{ top: top(from), height: top(to) - top(from) }}
                    >
                      <span className="font-semibold">{t("blocked")}</span> · {bl.reason}
                    </div>
                  );
                })}

                {boatTrips.map((tr) => (
                  <TripBox
                    key={tr.id}
                    trip={tr}
                    t={t}
                    lang={lang}
                    className={color.box}
                    top={top(clampMin(startOf(tr.starts_at)))}
                    height={Math.max(
                      top(clampMin(endOf(tr.ends_at))) -
                        top(clampMin(startOf(tr.starts_at))),
                      48,
                    )}
                  />
                ))}

                {showNow && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500"
                    style={{ top: top(nowMin) }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {trips.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-28 z-20 flex justify-center">
          <span className="rounded-full bg-white px-3 py-1 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            {t("noTripsDay")}
          </span>
        </div>
      )}
    </div>
  );
}

export function Pill({ pill, t }: { pill: ReturnType<typeof tripPill>; t: T }) {
  if (!pill) return null;
  return (
    <span className={`max-w-full truncate rounded px-1 text-[10px] font-semibold uppercase leading-4 ${pill.cls}`}>{t(pill.key)}</span>
  );
}

// Thin bar along the bottom of a shared-tour card showing how full it is.
export function FillBar({ trip }: { trip: Availability }) {
  if (trip.kind !== "shared" || trip.status !== "scheduled") return null;
  return (
    <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
      <span className="block h-full bg-current opacity-50" style={{ width: `${tripFill(trip)}%` }} />
    </span>
  );
}

function TripBox({
  trip,
  t,
  lang,
  className,
  top,
  height,
}: {
  trip: Availability;
  t: T;
  lang: Lang;
  className: string;
  top: number;
  height: number;
}) {
  const cancelled = trip.status !== "scheduled";
  const name = lang === "es" ? trip.product_name_es : trip.product_name_en;
  const pill = tripPill(trip);

  return (
    <Link
      href={`/departures/${trip.id}`}
      title={`${fmtTime(trip.starts_at, lang)}–${fmtTime(trip.ends_at, lang)} · ${name} · ${tripLoad(trip, t)}${pill ? ` · ${t(pill.key)}` : ""}`}
      className={`absolute inset-x-1 flex flex-col gap-0.5 overflow-hidden rounded-md border-l-4 px-2 py-1 text-xs shadow-sm hover:brightness-95 focus-visible:z-20 ${
        cancelled ? "z-[4] border-slate-300 bg-slate-100 text-slate-500" : `z-[5] ${className}`
      }`}
      style={{ top, height }}
    >
      <div className="flex flex-wrap gap-x-1 font-semibold tabular-nums">
        <span>{fmtTime(trip.starts_at, lang)}</span>
        <span className="font-normal opacity-70">– {fmtTime(trip.ends_at, lang)}</span>
      </div>
      <div className={`truncate text-sm font-semibold ${cancelled ? "line-through" : ""}`}>{name}</div>
      <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
        {!cancelled && <span>{tripLoad(trip, t)}</span>}
        <Pill pill={pill} t={t} />
      </div>
      <FillBar trip={trip} />
    </Link>
  );
}
