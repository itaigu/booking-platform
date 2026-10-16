import Link from "next/link";
import type { ReactNode } from "react";
import { pageContext } from "@/lib/auth";
import { addDays, dayStart, fmtClock, fmtDayShort, fmtLongDate, fmtMoney, fmtTime, isDay, todayLocal } from "@/lib/format";
import type { Lang, T } from "@/lib/i18n";
import type { Availability } from "@/lib/types";
import { DateJump } from "@/components/date-jump";
import { Badge, Flash, PageTitle } from "@/components/ui";
import { CheckInButton } from "./check-in-button";
import { PrintButton } from "./print-button";

// One booking on the day's manifest (from day_manifest()).
// Money and internal notes are empty for captains and crew.
type Row = {
  departure_id: number;
  booking_id: number;
  booking_number: string;
  guests: number;
  status: string;
  channel: string;
  ota_name: string | null;
  hotel_name: string | null;
  occasion: string | null;
  special_requests: string | null;
  internal_notes: string | null;
  full_name: string;
  phone: string | null;
  pickup_time: string | null;
  pickup_place: string | null;
  checked_in_at: string | null;
  items: string | null;
  total_price: number | null;
  paid: number | null;
};

type Crew = { departure_id: number; position: "captain" | "crew"; staff: { full_name: string } | null };

const show = ["all", "arrived", "missing"] as const;

// "11:40:00" → "11:40 a.m."
const clock = (time: string | null, lang: Lang) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return fmtClock(h * 60 + m, lang);
};

export default async function ManifestPage({ searchParams }: PageProps<"/manifest">) {
  const sp = await searchParams;
  const { supabase, staff, lang, t } = await pageContext();
  const date = isDay(sp.date as string) ? (sp.date as string) : todayLocal();
  const filter = show.find((s) => s === sp.show) ?? "all";
  const money = staff.role !== "crew";
  const canOpenBooking = staff.role !== "crew";

  const [{ data: rowData, error }, { data: tripData }] = await Promise.all([
    supabase.rpc("day_manifest", { p_day: date }),
    supabase
      .from("departure_availability")
      .select("*")
      .gte("starts_at", dayStart(date))
      .lt("starts_at", dayStart(addDays(date, 1)))
      .order("starts_at"),
  ]);
  const rows = (rowData ?? []) as Row[];
  // Only trips that have someone booked on them.
  const trips = ((tripData ?? []) as Availability[]).filter((tr) => rows.some((r) => r.departure_id === tr.id));
  const { data: crewData } = trips.length
    ? await supabase
        .from("crew_assignments")
        .select("departure_id, position, staff(full_name)")
        .in("departure_id", trips.map((tr) => tr.id))
    : { data: [] };
  const crew = (crewData ?? []) as unknown as Crew[];

  const guests = rows.reduce((s, r) => s + r.guests, 0);
  const arrived = rows.filter((r) => r.checked_in_at).reduce((s, r) => s + r.guests, 0);
  const visible = (r: Row) => filter === "all" || (filter === "arrived") === !!r.checked_in_at;

  const q = (d: string, f: string = filter) => `/manifest?date=${d}${f !== "all" ? `&show=${f}` : ""}`;
  const seg = (on: boolean) =>
    `inline-flex items-center rounded-md px-3 text-sm font-medium ${on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`;
  const arrow = "grid w-11 place-items-center text-slate-600 hover:bg-slate-50 focus-visible:-outline-offset-2 sm:w-9";
  const checkInLabels = { arrived: t("arrivedOne"), mark: t("checkIn"), undo: t("undoArrived") };

  return (
    <>
      <PageTitle actions={<span className="print:hidden"><PrintButton label={t("print")} /></span>}>
        {t("manifestPage")}
        <span className="hidden print:inline"> · {fmtLongDate(date, lang)}</span>
      </PageTitle>
      <Flash error={error?.message} />

      {/* Today, ‹ ›, the date (tap to pick another) and the check-in filter. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href={q(todayLocal())}
          className="inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:h-9"
        >
          {t("today")}
        </Link>
        <div className="inline-flex h-11 overflow-hidden rounded-md border border-slate-300 bg-white sm:h-9">
          <Link href={q(addDays(date, -1))} aria-label={t("prevDay")} title={t("prevDay")} className={arrow}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <Link href={q(addDays(date, 1))} aria-label={t("nextDay")} title={t("nextDay")} className={`${arrow} border-l border-slate-300`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
        <DateJump
          key={date}
          date={date}
          week={false}
          path="/manifest"
          label={fmtLongDate(date, lang)}
          shortLabel={fmtDayShort(date, lang)}
          ariaLabel={t("chooseDate")}
        />
        <div role="group" aria-label={t("checkIn")} className="inline-flex h-11 rounded-lg bg-slate-100 p-0.5 sm:ml-auto sm:h-9">
          {show.map((f) => (
            <Link key={f} href={q(date, f)} aria-current={filter === f ? "page" : undefined} className={seg(filter === f)}>
              {t(f === "all" ? "showAll" : f === "arrived" ? "showArrived" : "showMissing")}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {t("noBookingsToday")}
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">
            {t("dayTotals").replace("{g}", String(guests)).replace("{b}", String(rows.length)).replace("{t}", String(trips.length))}
            {" · "}
            <span className="font-medium text-slate-900">
              {t("arrivedOf").replace("{n}", String(arrived)).replace("{m}", String(guests))}
            </span>
          </p>

          {trips.map((trip) => {
            const list = rows.filter((r) => r.departure_id === trip.id);
            const shown = list.filter(visible);
            const tripGuests = list.reduce((s, r) => s + r.guests, 0);
            const tripArrived = list.filter((r) => r.checked_in_at).reduce((s, r) => s + r.guests, 0);
            const people = crew
              .filter((c) => c.departure_id === trip.id && c.staff)
              .sort((a, b) => (a.position === b.position ? 0 : a.position === "captain" ? -1 : 1))
              .map((c) => c.staff!.full_name);
            const balance = list.reduce((s, r) => s + Number(r.total_price ?? 0) - Number(r.paid ?? 0), 0);
            return (
              <section key={trip.id} className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm print:break-inside-avoid print:shadow-none">
                <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h2 className="text-base font-semibold text-slate-900">
                    <Link href={`/departures/${trip.id}`} className="hover:underline">
                      {fmtTime(trip.starts_at, lang)} · {lang === "es" ? trip.product_name_es : trip.product_name_en}
                    </Link>
                  </h2>
                  {trip.status !== "scheduled" && <Badge tone="red">{t("tripCancelledShort")}</Badge>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>{trip.boat_name} ({tripGuests}/{trip.capacity})</span>
                    {people.length > 0 && <span>{t("crewOnBoard")}: {people.join(", ")}</span>}
                    <span>{list.length} {t(list.length === 1 ? "bookingOne" : "bookingsCount")}</span>
                    <span className={tripArrived === tripGuests ? "font-medium text-green-700" : ""}>
                      {t("arrivedOf").replace("{n}", String(tripArrived)).replace("{m}", String(tripGuests))}
                    </span>
                    {money && balance > 0 && <span className="text-red-700">{t("balance")}: {fmtMoney(balance)}</span>}
                  </div>
                </header>

                {shown.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-500">{t("noResults")}</p>
                ) : (
                  <>
                    {/* Wide screens and print: a table */}
                    <div className="hidden overflow-x-auto md:block print:block">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs text-slate-500">
                          <tr className="border-b border-slate-100">
                            <th className="py-2 pr-3 pl-4 font-medium">{t("checkIn")}</th>
                            <th className="py-2 pr-3 font-medium">{t("customer")}</th>
                            <th className="py-2 pr-3 font-medium">{t("guests")}</th>
                            <th className="py-2 pr-3 font-medium">{t("pickup")}</th>
                            <th className="py-2 pr-3 font-medium">{t("bookedItems")}</th>
                            <th className="py-2 pr-3 font-medium">{t("notesCol")}</th>
                            {money && <th className="py-2 pr-3 text-right font-medium">{t("total")}</th>}
                            {money && <th className="py-2 pr-3 text-right font-medium">{t("paid")}</th>}
                            {money && <th className="py-2 pr-4 text-right font-medium">{t("balance")}</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 align-top">
                          {shown.map((r) => (
                            <tr key={r.booking_id} className={r.checked_in_at ? "bg-green-50/50" : ""}>
                              <td className="py-2 pr-3 pl-4">
                                <CheckInButton bookingId={r.booking_id} checkedIn={!!r.checked_in_at} time={r.checked_in_at && fmtTime(r.checked_in_at, lang)} labels={checkInLabels} />
                              </td>
                              <td className="py-2 pr-3"><Customer r={r} link={canOpenBooking} t={t} /></td>
                              <td className="py-2 pr-3 font-medium">{r.guests}</td>
                              <td className="py-2 pr-3">
                                {clock(r.pickup_time, lang)}
                                {r.pickup_place && <div className="text-slate-600">{r.pickup_place}</div>}
                              </td>
                              <td className="max-w-56 py-2 pr-3 text-slate-700">{r.items}</td>
                              <td className="max-w-72 py-2 pr-3"><Notes r={r} t={t} /></td>
                              {money && <td className="py-2 pr-3 text-right whitespace-nowrap">{fmtMoney(r.total_price)}</td>}
                              {money && <td className="py-2 pr-3 text-right whitespace-nowrap">{fmtMoney(r.paid)}</td>}
                              {money && <td className="py-2 pr-4 text-right whitespace-nowrap"><Balance r={r} /></td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Phones: one card per booking */}
                    <ul className="divide-y divide-slate-100 md:hidden print:hidden">
                      {shown.map((r) => (
                        <li key={r.booking_id} className={`flex flex-col gap-2 px-4 py-3 text-sm ${r.checked_in_at ? "bg-green-50/50" : ""}`}>
                          <div className="flex items-start justify-between gap-3">
                            <Customer r={r} link={canOpenBooking} t={t} />
                            <span className="shrink-0 text-base font-semibold">{r.guests} pax</span>
                          </div>
                          {(r.pickup_time || r.pickup_place) && (
                            <div><span className="text-slate-500">{t("pickup")}:</span> {[clock(r.pickup_time, lang), r.pickup_place].filter(Boolean).join(" · ")}</div>
                          )}
                          {r.items && <div className="text-slate-700">{r.items}</div>}
                          <Notes r={r} t={t} />
                          {money && (
                            <div className="flex flex-wrap gap-x-4 text-slate-600">
                              <span>{t("total")}: {fmtMoney(r.total_price)}</span>
                              <span>{t("paid")}: {fmtMoney(r.paid)}</span>
                              <span>{t("balance")}: <Balance r={r} /></span>
                            </div>
                          )}
                          <CheckInButton bookingId={r.booking_id} checkedIn={!!r.checked_in_at} time={r.checked_in_at && fmtTime(r.checked_in_at, lang)} labels={checkInLabels} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

function Customer({ r, link, t }: { r: Row; link: boolean; t: T }) {
  const source = r.hotel_name ?? (r.ota_name || t(`channel_${r.channel}` as never));
  return (
    <div className="min-w-0">
      <div className="font-medium text-slate-900">{r.full_name}</div>
      {r.phone && <a href={`tel:${r.phone}`} className="block text-slate-600 hover:underline">{r.phone}</a>}
      <div className="text-xs text-slate-500">
        {link ? <Link href={`/bookings/${r.booking_id}`} className="text-sky-700 underline">{r.booking_number}</Link> : r.booking_number}
        {" · "}
        {source}
        {r.status !== "confirmed" && <> · {t(`status_${r.status}` as never)}</>}
      </div>
    </div>
  );
}

function Notes({ r, t }: { r: Row; t: T }) {
  const parts: ReactNode[] = [];
  if (r.occasion) parts.push(<div key="o" className="font-medium text-amber-800">{r.occasion}</div>);
  if (r.special_requests) parts.push(<div key="s" className="whitespace-pre-line">{r.special_requests}</div>);
  if (r.internal_notes)
    parts.push(
      <div key="i" className="whitespace-pre-line text-slate-500">
        <span className="font-medium">{t("internalNotes")}:</span> {r.internal_notes}
      </div>,
    );
  return parts.length ? <div className="flex flex-col gap-1">{parts}</div> : null;
}

function Balance({ r }: { r: Row }) {
  const due = Math.round((Number(r.total_price ?? 0) - Number(r.paid ?? 0)) * 100) / 100;
  return <span className={due > 0 ? "font-medium text-red-700" : "text-slate-600"}>{fmtMoney(due)}</span>;
}
