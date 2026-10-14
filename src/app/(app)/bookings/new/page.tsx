import Link from "next/link";
import { pageContext } from "@/lib/auth";
import { addDays, dayStart, fmtDateTime, fmtTime, isDay, todayLocal } from "@/lib/format";
import { translator } from "@/lib/i18n";
import type { Availability } from "@/lib/types";
import { Badge, Button, ButtonLink, Card, Field, Flash, Input, PageTitle } from "@/components/ui";
import { BookingForm } from "./booking-form";

export default async function NewBookingPage({ searchParams }: PageProps<"/bookings/new">) {
  const sp = await searchParams;
  const { supabase, lang, t } = await pageContext(["admin", "office"]);
  const departureId = Number(sp.departure);

  if (!departureId) {
    const date = isDay(sp.date as string) ? (sp.date as string) : todayLocal();
    const { data } = await supabase
      .from("departure_availability")
      .select("*")
      .eq("status", "scheduled")
      .gte("starts_at", dayStart(date))
      .lt("starts_at", dayStart(addDays(date, 1)))
      .order("starts_at");
    const trips = (data ?? []) as Availability[];

    return (
      <>
        <PageTitle>{t("newBooking")}: {t("chooseTrip")}</PageTitle>
        <form className="mb-4 flex items-end gap-2" action="/bookings/new">
          <Field label={t("date")}>
            <Input type="date" name="date" defaultValue={date} />
          </Field>
          <Button type="submit" variant="secondary">{t("search")}</Button>
        </form>
        <Card>
          {trips.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noTrips")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {trips.map((trip) => (
                <li key={trip.id}>
                  <Link
                    href={`/bookings/new?departure=${trip.id}`}
                    className={`flex flex-wrap items-center gap-x-4 py-2 hover:bg-slate-50 ${trip.seats_left === 0 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <span className="w-20 font-mono text-sm">{fmtTime(trip.starts_at, lang)}</span>
                    <span className="flex-1 font-medium">{lang === "es" ? trip.product_name_es : trip.product_name_en}</span>
                    <span className="text-sm text-slate-600">{trip.boat_name}</span>
                    {trip.seats_left === 0 ? (
                      <Badge tone="amber">{t("full")}</Badge>
                    ) : (
                      <Badge tone="green">{trip.seats_left} {t("seatsLeft")}</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  const { data: trip } = await supabase.from("departure_availability").select("*").eq("id", departureId).maybeSingle<Availability>();
  if (!trip) return <Flash error={t("noResults")} />;

  const [{ data: tickets }, { data: product }] = await Promise.all([
    supabase.from("ticket_types").select("id, name_en, name_es, price").eq("product_id", trip.product_id).eq("active", true).order("price", { ascending: false }),
    supabase.from("products").select("base_guests").eq("id", trip.product_id).single(),
  ]);

  // Labels for the form, which runs in the browser.
  const keys = [
    "customer", "name", "email", "phone", "language", "emergencyContact", "emergencyPhone", "channel",
    "otaName", "otaReference", "occasion", "occasionHint", "specialRequests", "internalNotes", "tickets",
    "guests", "estimate", "priceOverride", "priceOverrideHint", "createBooking", "seatsLeft", "details",
    "channel_phone", "channel_whatsapp", "channel_walk_in", "channel_ota", "channel_other", "baseGuests",
  ] as const;
  const tr = translator(lang);
  const labels = Object.fromEntries(keys.map((k) => [k, tr(k)])) as Record<(typeof keys)[number], string>;

  return (
    <>
      <PageTitle actions={<ButtonLink variant="secondary" href={`/departures/${trip.id}`}>‹ {t("back")}</ButtonLink>}>
        {t("newBooking")}
      </PageTitle>
      <Flash error={sp.error as string | undefined} />
      <Card>
        <p className="font-medium">{lang === "es" ? trip.product_name_es : trip.product_name_en}</p>
        <p className="text-sm text-slate-600">
          {fmtDateTime(trip.starts_at, lang)} · {trip.boat_name} · {trip.seats_left} {t("seatsLeft")}
        </p>
      </Card>
      <BookingForm
        departureId={trip.id}
        kind={trip.kind}
        seatsLeft={trip.seats_left}
        baseGuests={product?.base_guests ?? null}
        tickets={(tickets ?? []).map((tt) => ({ id: tt.id, name: lang === "es" ? tt.name_es : tt.name_en }))}
        labels={labels}
        lang={lang}
      />
    </>
  );
}
