import Link from "next/link";
import { pageContext } from "@/lib/auth";
import { addDays, dayStart, fmtDateTime, fmtTime, isDay, todayLocal } from "@/lib/format";
import { translator } from "@/lib/i18n";
import type { Availability } from "@/lib/types";
import { Badge, Button, ButtonLink, Card, Field, Flash, Input, PageTitle } from "@/components/ui";
import { BookingForm } from "./booking-form";
import { TripBookingForm, type Template } from "./trip-booking-form";

// Labels for the customer part of both forms, which run in the browser.
const customerKeys = [
  "customer", "name", "email", "phone", "language", "emergencyContact", "emergencyPhone", "channel",
  "otaName", "otaReference", "occasion", "occasionHint", "specialRequests", "internalNotes", "details",
  "channel_phone", "channel_whatsapp", "channel_walk_in", "channel_ota", "channel_other", "createBooking",
] as const;
const tripKeys = [
  ...customerKeys,
  "secTrip", "secTripDesc", "fromTour", "fromTourNone", "fromTourHint", "tripName", "tripNamePh", "kind",
  "private", "shared", "privateDesc", "sharedTripDesc", "secWhen", "secWhenDesc", "date", "boat", "time",
  "duration", "bufferMin", "bufferHint", "boatFree", "secPax", "paxIncluded", "paxIncludedHint", "basePrice",
  "extraPax", "extraGuestPrice", "extraHours", "extraHourPrice", "paxThisBooking", "pricePerPerson",
  "seatsThisTrip", "minGuests", "priceSummary", "lineCharter", "upTo", "total", "priceOverride",
  "priceOverrideHint", "saving", "less", "more", "morning", "afternoon", "evening", "minutes",
] as const;

export default async function NewBookingPage({ searchParams }: PageProps<"/bookings/new">) {
  const sp = await searchParams;
  const { supabase, lang, t } = await pageContext(["admin", "office"]);
  const departureId = Number(sp.departure);

  const date = isDay(sp.date as string) ? (sp.date as string) : todayLocal();
  const tr = translator(lang);

  // Default: a new trip with its own details, created together with the booking.
  if (!departureId && sp.existing !== "1") {
    const [{ data: tourData }, { data: boatData }] = await Promise.all([
      supabase
        .from("products")
        .select("*, ticket_types(price, active), product_boats(boat_id)")
        .eq("one_off", false)
        .eq("active", true)
        .order("name_es"),
      supabase.from("boats").select("id, name, max_guests").eq("active", true).order("name"),
    ]);
    type Row = Omit<Template, "name" | "guest_price" | "boat_id"> & {
      name_es: string;
      name_en: string;
      ticket_types: { price: number; active: boolean }[];
      product_boats: { boat_id: number }[];
    };
    const templates: Template[] = ((tourData ?? []) as Row[]).map((p) => {
      const prices = p.ticket_types.filter((x) => x.active).map((x) => Number(x.price));
      return {
        id: p.id,
        name: p.name_es || p.name_en,
        kind: p.kind,
        duration_minutes: p.duration_minutes,
        buffer_minutes: p.buffer_minutes,
        min_guests: p.min_guests,
        max_guests: p.max_guests,
        base_price: p.base_price,
        base_guests: p.base_guests,
        extra_guest_price: p.extra_guest_price,
        extra_hour_price: p.extra_hour_price,
        guest_price: prices.length ? Math.max(...prices) : null,
        boat_id: p.product_boats[0]?.boat_id ?? null,
      };
    });
    const labels = Object.fromEntries(tripKeys.map((k) => [k, tr(k)]));

    return (
      <>
        <PageTitle
          actions={
            <ButtonLink variant="secondary" href={`/bookings/new?existing=1&date=${date}`}>
              {t("joinExisting")}
            </ButtonLink>
          }
        >
          {t("newBooking")}
        </PageTitle>
        {(boatData ?? []).length === 0 ? (
          <Flash error={t("noBoats")} />
        ) : (
          <TripBookingForm templates={templates} boats={boatData ?? []} date={date} labels={labels} lang={lang} />
        )}
      </>
    );
  }

  // Add guests to a trip that is already on the calendar.
  if (!departureId) {
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
        <PageTitle actions={<ButtonLink variant="secondary" href={`/bookings/new?date=${date}`}>{t("newTripInstead")}</ButtonLink>}>
          {t("newBooking")}: {t("chooseTrip")}
        </PageTitle>
        <form className="mb-4 flex items-end gap-2" action="/bookings/new">
          <input type="hidden" name="existing" value="1" />
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

  const bookingKeys = [...customerKeys, "tickets", "guests", "estimate", "priceOverride", "priceOverrideHint", "seatsLeft", "baseGuests"] as const;
  const labels = Object.fromEntries(bookingKeys.map((k) => [k, tr(k)]));

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
