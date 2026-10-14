import Link from "next/link";
import type { Lang, T } from "@/lib/i18n";
import { canBook, pageContext } from "@/lib/auth";
import { addDays, dayStart, fmtDate, fmtTime, isDay, localDayOf, todayLocal } from "@/lib/format";
import { Badge, Button, ButtonLink, Card, Field, Flash, Input, PageTitle, Select } from "@/components/ui";
import { createTrip } from "./actions";
import type { Availability } from "@/lib/types";




export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const { supabase, staff, lang, t } = await pageContext();
  const date = isDay(sp.date as string) ? (sp.date as string) : todayLocal();
  const view = sp.view === "day" ? "day" : "week";
  const days = view === "day" ? 1 : 7;
  const end = addDays(date, days);

  const [{ data: trips }, { data: blocks }, { data: products }, { data: boats }] = await Promise.all([
    supabase
      .from("departure_availability")
      .select("*")
      .gte("starts_at", dayStart(date))
      .lt("starts_at", dayStart(end))
      .order("starts_at"),
    supabase
      .from("boat_blocks")
      .select("id, starts_at, ends_at, reason, boats(name)")
      .lt("starts_at", dayStart(end))
      .gt("ends_at", dayStart(date)),
    supabase.from("products").select("id, name_en, name_es").eq("active", true).order("name_en"),
    supabase.from("boats").select("id, name").eq("active", true).order("name"),
  ]);

  const byDay = new Map<string, Availability[]>();
  for (let i = 0; i < days; i++) byDay.set(addDays(date, i), []);
  for (const trip of (trips ?? []) as Availability[]) byDay.get(localDayOf(trip.starts_at))?.push(trip);

  const q = (d: string, v = view) => `/calendar?date=${d}&view=${v}`;
  const error = sp.error === "noAccess" ? t("noAccess") : (sp.error as string | undefined);

  return (
    <>
      <PageTitle
        actions={
          <>
            <ButtonLink variant="secondary" href={q(addDays(date, -days))}>‹ {t("previous")}</ButtonLink>
            <ButtonLink variant="secondary" href={q(todayLocal())}>{t("today")}</ButtonLink>
            <ButtonLink variant="secondary" href={q(addDays(date, days))}>{t("next")} ›</ButtonLink>
            <ButtonLink variant={view === "day" ? "primary" : "secondary"} href={q(date, "day")}>{t("day")}</ButtonLink>
            <ButtonLink variant={view === "week" ? "primary" : "secondary"} href={q(date, "week")}>{t("week")}</ButtonLink>
          </>
        }
      >
        {t("calendar")}
      </PageTitle>
      <Flash error={error} ok={sp.ok as string | undefined} />

      <form className="mb-4 flex items-end gap-2" action="/calendar">
        <input type="hidden" name="view" value={view} />
        <Field label={t("date")}>
          <Input type="date" name="date" defaultValue={date} />
        </Field>
        <Button variant="secondary" type="submit">{t("search")}</Button>
      </form>

      {(blocks ?? []).length > 0 && (
        <Card>
          <ul className="space-y-1 text-sm">
            {(blocks ?? []).map((b) => (
              <li key={b.id}>
                🔧 <strong>{(b.boats as unknown as { name: string } | null)?.name ?? t("allBoats")}</strong>: {b.reason} (
                {fmtDate(b.starts_at, lang)} {fmtTime(b.starts_at, lang)} – {fmtDate(b.ends_at, lang)} {fmtTime(b.ends_at, lang)})
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="space-y-4">
        {[...byDay.entries()].map(([day, list]) => (
          <Card key={day} title={fmtDate(dayStart(day), lang)}>
            {list.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noTrips")}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((trip) => (
                  <TripRow key={trip.id} trip={trip} lang={lang} t={t} />
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {canBook(staff.role) && (
        <Card title={t("addTrip")} className="mt-6">
          <form action={createTrip} className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
            <Field label={t("tour")}>
              <Select name="product_id" required>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{lang === "es" ? p.name_es : p.name_en}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("boat")}>
              <Select name="boat_id" required>
                {(boats ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("date")}>
              <Input type="date" name="date" defaultValue={date} required />
            </Field>
            <Field label={t("time")}>
              <Input type="time" name="time" required />
            </Field>
            <Button type="submit">{t("add")}</Button>
          </form>
        </Card>
      )}
    </>
  );
}

function TripRow({ trip, lang, t }: { trip: Availability; lang: Lang; t: T }) {
  const cancelled = trip.status !== "scheduled";
  const name = lang === "es" ? trip.product_name_es : trip.product_name_en;
  let badge;
  if (cancelled) badge = <Badge tone="red">{t(`dep_${trip.status}`)}</Badge>;
  else if (trip.seats_left === 0) badge = <Badge tone="amber">{t("full")}</Badge>;
  else if (trip.kind === "shared" && trip.guests_booked > 0 && trip.guests_booked < trip.min_guests)
    badge = <Badge tone="amber">{t("belowMinimum")}</Badge>;
  else badge = <Badge tone="green">{t("available")}</Badge>;

  return (
    <li>
      <Link href={`/departures/${trip.id}`} className={`flex flex-wrap items-center gap-x-4 gap-y-1 py-2 hover:bg-slate-50 ${cancelled ? "opacity-60" : ""}`}>
        <span className="w-20 font-mono text-sm">{fmtTime(trip.starts_at, lang)}</span>
        <span className="flex-1 font-medium">{name}</span>
        <span className="text-sm text-slate-600">{trip.boat_name}</span>
        <span className="w-48 text-sm text-slate-600">
          {trip.kind === "private"
            ? trip.bookings_count > 0 ? `${trip.guests_booked} ${t("guests").toLowerCase()}` : t("private")
            : `${trip.guests_booked}/${trip.capacity} ${t("booked")} · ${trip.seats_left} ${t("seatsLeft")}`}
        </span>
        {badge}
      </Link>
    </li>
  );
}
