import Link from "next/link";
import type { ReactNode } from "react";
import { pageContext } from "@/lib/auth";
import { addDays, dayStart, fmtClock, fmtDayShort, fmtLongDate, fmtMoney, fmtTime, isDay, todayLocal } from "@/lib/format";
import type { Lang, T } from "@/lib/i18n";
import type { Availability } from "@/lib/types";
import { DateJump } from "@/components/date-jump";
import { Badge, Flash, PageTitle } from "@/components/ui";
import { CheckInButton } from "./check-in-button";
import { ManifestTools } from "./manifest-tools";
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
  ota_reference: string | null;
  hotel_code: string | null;
  promo_code: string | null;
  created_by_name: string | null;
};

const show = ["all", "arrived", "missing"] as const;
// Each view is the manifest for a different job: the dock (check-in) and the office (admin).
const views = ["dock", "admin"] as const;

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
  // Captains and crew only get the dock view.
  const myViews = staff.role === "crew" ? (["dock"] as const) : views;
  const view = myViews.find((v) => v === sp.view) ?? "dock";
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
  // The captain and crew written on each trip.
  const { data: crewData } = trips.length
    ? await supabase.from("departures").select("id, crew").in("id", trips.map((tr) => tr.id))
    : { data: [] };
  const crew = new Map(((crewData ?? []) as { id: number; crew: string | null }[]).map((d) => [d.id, d.crew]));

  const guests = rows.reduce((s, r) => s + r.guests, 0);
  const arrived = rows.filter((r) => r.checked_in_at).reduce((s, r) => s + r.guests, 0);
  const visible = (r: Row) => filter === "all" || (filter === "arrived") === !!r.checked_in_at;

  const q = (d: string, f: string = filter, v: string = view) =>
    `/manifest?date=${d}${f !== "all" ? `&show=${f}` : ""}${v !== "dock" ? `&view=${v}` : ""}`;
  const seg = (on: boolean) =>
    `inline-flex items-center rounded-md px-3 text-sm font-medium ${on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`;
  const arrow = "grid w-11 place-items-center text-slate-600 hover:bg-slate-50 focus-visible:-outline-offset-2 sm:w-9";
  const checkInLabels = { arrived: t("arrivedOne"), mark: t("checkIn"), undo: t("undoArrived") };

  // Columns of the admin view, in order (the first one is check-in).
  const checkIn = (r: Row) => (
    <CheckInButton bookingId={r.booking_id} checkedIn={!!r.checked_in_at} time={r.checked_in_at && fmtTime(r.checked_in_at, lang)} labels={checkInLabels} />
  );
  const adminCols: { key: string; label: string; right?: boolean; wide?: boolean; cell: (r: Row) => ReactNode }[] = [
    { key: "checkin", label: t("checkIn"), cell: checkIn },
    {
      key: "number",
      label: t("bookingNumber"),
      cell: (r) => (canOpenBooking ? <Link href={`/bookings/${r.booking_id}`} className="text-sky-700 underline">{r.booking_number}</Link> : r.booking_number),
    },
    { key: "customer", label: t("customer"), cell: (r) => <>{r.full_name} <span className="text-slate-500">· {r.guests} pax</span></> },
    { key: "balance", label: t("balance"), right: true, cell: (r) => <Balance r={r} /> },
    { key: "total", label: t("total"), right: true, cell: (r) => fmtMoney(r.total_price) },
    { key: "agent", label: t("agent"), cell: (r) => r.hotel_name ?? (r.ota_name || t(`channel_${r.channel}` as never)) },
    { key: "coupon", label: t("coupon"), cell: (r) => r.promo_code },
    { key: "internal", label: t("internalNotes"), wide: true, cell: (r) => r.internal_notes && <span className="whitespace-pre-line">{r.internal_notes}</span> },
    { key: "extras", label: t("extrasCol"), wide: true, cell: (r) => r.items },
    {
      key: "requests",
      label: t("specialRequests"),
      wide: true,
      cell: (r) => [r.occasion, r.special_requests].filter(Boolean).join(" · ") || null,
    },
    { key: "by", label: t("bookedBy"), cell: (r) => r.created_by_name },
    { key: "ref", label: t("agentRef"), cell: (r) => r.hotel_code ?? r.ota_reference },
  ];

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

          <ManifestTools
            view={view}
            views={myViews.map((v) => ({ id: v, label: t(v === "admin" ? "viewAdmin" : "viewDock") }))}
            hrefFor={Object.fromEntries(myViews.map((v) => [v, q(date, filter, v)]))}
            labels={{ view: t("manifestView"), openAll: t("openAll"), closeAll: t("closeAll") }}
          />

          {trips.map((trip) => {
            const list = rows.filter((r) => r.departure_id === trip.id);
            const shown = list.filter(visible);
            const tripGuests = list.reduce((s, r) => s + r.guests, 0);
            const tripArrived = list.filter((r) => r.checked_in_at).reduce((s, r) => s + r.guests, 0);
            const people = crew.get(trip.id);
            // "4 × Adulto, 2 × Pax extra" across the trip's bookings
            const types = new Map<string, number>();
            for (const r of list)
              for (const part of (r.items ?? "").split(", ")) {
                const m = part.match(/^(\d+) × (.+)$/);
                if (m) types.set(m[2], (types.get(m[2]) ?? 0) + Number(m[1]));
              }
            const guestTypes = [...types].map(([d, n]) => `${n} ${d}`).join(", ");
            const balance = list.reduce((s, r) => s + Number(r.total_price ?? 0) - Number(r.paid ?? 0), 0);
            return (
              <details
                key={trip.id}
                data-trip
                className="group mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm print:break-inside-avoid print:shadow-none"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-slate-50 group-open:border-b group-open:border-slate-200 group-open:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90 print:hidden" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1">
                    <h2 className="text-base font-semibold text-sky-800">
                      {fmtTime(trip.starts_at, lang)} · {lang === "es" ? trip.product_name_es : trip.product_name_en}
                    </h2>
                    {trip.status !== "scheduled" && <Badge tone="red">{t("tripCancelledShort")}</Badge>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                      <span className="font-medium">{list.length} {t(list.length === 1 ? "bookingOne" : "bookingsCount")}</span>
                      <span className="font-medium">
                        {tripGuests} pax{guestTypes ? ` (${guestTypes})` : ""}
                      </span>
                      <span>
                        {trip.boat_name} ({tripGuests}/{trip.capacity}){people ? `, ${people}` : ""}
                      </span>
                      <span className={tripArrived === tripGuests ? "font-medium text-green-700" : ""}>
                        {t("arrivedOf").replace("{n}", String(tripArrived)).replace("{m}", String(tripGuests))}
                      </span>
                      {money && balance > 0 && <span className="text-red-700">{t("balance")}: {fmtMoney(balance)}</span>}
                    </div>
                  </div>
                  <Link
                    href={`/departures/${trip.id}`}
                    title={t("openTrip")}
                    aria-label={t("openTrip")}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900 print:hidden"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
                    </svg>
                  </Link>
                </summary>

                {shown.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-500">{t("noResults")}</p>
                ) : (
                  <>
                    {view === "admin" ? (
                      <>
                        {/* Office view: who sold it, agents, coupons and money */}
                        <div className="hidden overflow-x-auto md:block print:block">
                          <table className="w-full text-left text-sm">
                            <thead className="text-xs text-slate-500">
                              <tr className="border-b border-slate-100">
                                {adminCols.map((c, n) => (
                                  <th key={c.key} className={`py-2 pr-3 font-medium ${n === 0 ? "pl-4" : ""} ${c.right ? "text-right" : ""}`}>{c.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 align-top">
                              {shown.map((r) => (
                                <tr key={r.booking_id} className={r.checked_in_at ? "bg-green-50/50" : ""}>
                                  {adminCols.map((c, n) => (
                                    <td key={c.key} className={`py-2 pr-3 ${n === 0 ? "pl-4" : ""} ${c.right ? "text-right whitespace-nowrap" : ""} ${c.key === "number" ? "whitespace-nowrap" : ""} ${c.wide ? "max-w-64" : ""}`}>{c.cell(r)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <ul className="divide-y divide-slate-100 md:hidden print:hidden">
                          {shown.map((r) => (
                            <li key={r.booking_id} className={`flex flex-col gap-1.5 px-4 py-3 text-sm ${r.checked_in_at ? "bg-green-50/50" : ""}`}>
                              {adminCols.slice(1).map((c) => {
                                const v = c.cell(r);
                                return v ? (
                                  <div key={c.key}><span className="text-slate-500">{c.label}:</span> {v}</div>
                                ) : null;
                              })}
                              <div className="pt-1">{adminCols[0].cell(r)}</div>
                            </li>
                          ))}
                        </ul>
                      </>
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
                  </>
                )}
              </details>
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
