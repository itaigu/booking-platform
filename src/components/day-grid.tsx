import Link from "next/link";
import type { Lang, T } from "@/lib/i18n";
import { colorOf } from "@/lib/colors";
import { fmtTime, localDayOf, localMinutes, todayLocal } from "@/lib/format";
import type { Availability } from "@/lib/types";
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
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex min-w-full">
        {/* Hour labels */}
        <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-slate-200 bg-white">
          <div className="h-10 border-b border-slate-200" />
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-2 text-xs text-slate-500"
                style={{ top: top(h * 60) }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {/* One column per boat */}
        {boats.map((boat) => {
          const color = colorOf(boat.color);
          const boatTrips = trips.filter((tr) => tr.boat_id === boat.id);
          const boatBlocks = blocks.filter(
            (bl) => bl.boat_id === boat.id || bl.boat_id === null,
          );
          return (
            <div
              key={boat.id}
              className="min-w-40 flex-1 border-r border-slate-200 last:border-r-0 sm:min-w-44"
            >
              <div
                className={`flex h-10 items-center justify-center truncate px-2 text-sm font-semibold ${color.head}`}
              >
                {boat.name}
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
                      className="absolute inset-x-1 overflow-hidden rounded-md border border-slate-300 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_12px)] p-1 text-xs text-slate-600"
                      style={{ top: top(from), height: top(to) - top(from) }}
                    >
                      🔧 {t("blocked")}: {bl.reason}
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
                      44,
                    )}
                  />
                ))}

                {showNow && (
                  <div
                    className="absolute inset-x-0 z-10 border-t-2 border-red-500"
                    style={{ top: top(nowMin) }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
  const belowMin =
    trip.kind === "shared" &&
    trip.guests_booked > 0 &&
    trip.guests_booked < trip.min_guests;
  const seats =
    trip.kind === "private"
      ? trip.bookings_count > 0
        ? `${trip.guests_booked} ${t("guests").toLowerCase()}`
        : t("available")
      : `${trip.guests_booked}/${trip.capacity}`;

  return (
    <Link
      href={`/departures/${trip.id}`}
      className={`absolute inset-x-1 z-[5] overflow-hidden rounded-md border-l-4 px-2 py-1 text-xs shadow-sm hover:brightness-95 ${className} ${
        cancelled ? "opacity-50 line-through" : ""
      }`}
      style={{ top, height }}
    >
      <div className="font-semibold">
        {fmtTime(trip.starts_at, lang)} – {fmtTime(trip.ends_at, lang)}
      </div>
      <div className="truncate font-medium">{name}</div>
      <div className="flex flex-wrap gap-1">
        <span>👥 {seats}</span>
        {cancelled && <span>· {t(`dep_${trip.status}`)}</span>}
        {!cancelled && trip.seats_left === 0 && (
          <span className="font-semibold">· {t("full")}</span>
        )}
        {!cancelled && belowMin && (
          <span className="font-semibold">· {t("belowMinimum")}</span>
        )}
      </div>
    </Link>
  );
}
