import Link from "next/link";
import { notFound } from "next/navigation";
import { canBook, pageContext } from "@/lib/auth";
import { fmtDate, fmtDateTime, fmtMoney, TZ_OFFSET } from "@/lib/format";
import type { Availability } from "@/lib/types";
import { ChangeHistory, type Change } from "@/components/change-history";
import { EditTripForm } from "@/components/edit-trip-form";
import { StatusBadge } from "@/components/status-badge";
import { Stepper } from "@/components/stepper";
import { Badge, Button, ButtonLink, Card, Field, Flash, Grid, Input, MoneyInput, PageTitle, Select, Textarea } from "@/components/ui";
import { changeGuests, makeHotelBooking, rescheduleBooking, setBookingStatus, updateBooking, updateHotelDetails } from "../actions";

type Booking = {
  id: number;
  booking_number: string;
  departure_id: number;
  customer_id: number;
  channel: string;
  ota_name: string | null;
  ota_reference: string | null;
  hotel_id: number | null;
  hotel_code: string | null;
  guests: number;
  total_price: number;
  status: string;
  occasion: string | null;
  special_requests: string | null;
  internal_notes: string | null;
  pickup_time: string | null;
  pickup_place: string | null;
  created_at: string;
  customers: {
    full_name: string;
    email: string | null;
    phone: string | null;
    language: string;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  };
  booking_items: { id: number; description: string; quantity: number; unit_price: number }[];
  staff: { full_name: string } | null;
  hotels: { name: string } | null;
};

type Commission = {
  commission_pct: number;
  commission_amount: number;
  status: "owed" | "paid" | "cancelled";
  paid_at: string | null;
};

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  // Captains and crew only see guest lists (on the trip page).
  const { supabase, staff, lang, t } = await pageContext(["admin", "office", "dock"]);

  const { data } = await supabase
    .from("bookings")
    .select("*, customers(*), booking_items(*), staff!bookings_created_by_fkey(full_name), hotels(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const b = data as unknown as Booking;

  const editable = canBook(staff.role);
  const [{ data: trip }, { data: product }, { data: boatData }, { count: customerBookings }, { data: history }, { data: commission }, { data: hotelData }] = await Promise.all([
    supabase.from("departure_availability").select("*").eq("id", b.departure_id).single<Availability>(),
    supabase
      .from("departures")
      .select("products(kind, one_off, base_guests, extra_guest_price, extra_hour_price)")
      .eq("id", b.departure_id)
      .single(),
    supabase.from("boats").select("id, name, max_guests, active").order("name"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("customer_id", b.customer_id),
    // Changes to this booking, its trip and its customer (admin and office only).
    editable
      ? supabase
          .from("change_log")
          .select("id, table_name, action, changes, changed_at, staff(full_name)")
          .or(
            `booking_id.eq.${b.id},and(table_name.eq.departures,departure_id.eq.${b.departure_id}),and(table_name.eq.customers,customer_id.eq.${b.customer_id})`,
          )
          .order("changed_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    // The hotel's commission (admin and office only).
    editable && b.channel === "hotel"
      ? supabase.from("commissions").select("commission_pct, commission_amount, status, paid_at").eq("booking_id", b.id).maybeSingle<Commission>()
      : Promise.resolve({ data: null }),
    // Hotels to choose from, to turn this booking into a hotel booking.
    editable && b.channel !== "hotel"
      ? supabase.from("hotels").select("id, name, default_commission_pct").eq("active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);
  const hotels = (hotelData ?? []) as { id: number; name: string; default_commission_pct: number }[];
  const boats = boatData ?? [];
  const prod = (product?.products ?? null) as unknown as {
    kind: "private" | "shared";
    one_off: boolean;
    base_guests: number | null;
    extra_guest_price: number | null;
    extra_hour_price: number | null;
  } | null;
  const onlyThisTrip = !!trip?.one_off;
  const oneOffPrivate = onlyThisTrip && prod?.kind === "private";
  // Most guests this booking can have: the boat for a one-off private trip,
  // otherwise its own guests plus the seats still free.
  const maxGuests = !trip ? b.guests : oneOffPrivate ? trip.boat_max : trip.kind === "private" ? trip.capacity : b.guests + trip.seats_left;
  const itemsTotal = b.booking_items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0);
  const adjustment = Math.round((Number(b.total_price) - itemsTotal) * 100) / 100;
  const sl = { less: t("less"), more: t("more") };

  // Other upcoming trips of the same tour with room for this group.
  let options: Availability[] = [];
  if (editable && b.status === "confirmed" && trip && !onlyThisTrip) {
    const { data: upcoming } = await supabase
      .from("departure_availability")
      .select("*")
      .eq("product_id", trip.product_id)
      .eq("status", "scheduled")
      .neq("id", trip.id)
      .gte("starts_at", new Date().toISOString())
      .gte("seats_left", b.guests)
      .order("starts_at")
      .limit(60);
    options = (upcoming ?? []) as Availability[];
  }

  const c = b.customers;
  const statusButton = (status: string, label: string, variant: "secondary" | "danger" = "secondary") => (
    <form action={setBookingStatus}>
      <input type="hidden" name="id" value={b.id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant}>{label}</Button>
    </form>
  );

  return (
    <>
      <PageTitle actions={<ButtonLink variant="secondary" href="/bookings">‹ {t("bookings")}</ButtonLink>}>
        {b.booking_number} <StatusBadge status={b.status} label={t(`status_${b.status}` as never)} />
      </PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />

      <Card>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">{t("trip")}</dt>
            <dd className="font-medium">
              <Link className="text-sky-700 underline" href={`/departures/${b.departure_id}`}>
                {trip && (lang === "es" ? trip.product_name_es : trip.product_name_en)}
              </Link>
              <div>{trip && fmtDateTime(trip.starts_at, lang)} · {trip?.boat_name}</div>
            </dd>
          </div>
          <div><dt className="text-slate-500">{t("guests")}</dt><dd className="font-medium">{b.guests}</dd></div>
          <div>
            <dt className="text-slate-500">{t("channel")}</dt>
            <dd className="font-medium">
              {t(`channel_${b.channel}` as never)}
              {b.ota_name ? ` · ${b.ota_name}` : ""}
              {b.ota_reference ? ` (${b.ota_reference})` : ""}
              {b.hotels ? ` · ${b.hotels.name}` : ""}
              {b.hotel_code && <div className="font-mono font-normal">{b.hotel_code}</div>}
            </dd>
          </div>
          <div><dt className="text-slate-500">{t("createdAt")}</dt><dd>{fmtDateTime(b.created_at, lang)}{b.staff ? ` · ${b.staff.full_name}` : ""}</dd></div>
        </dl>
      </Card>

      <Card title={t("items")}>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {b.booking_items.map((i) => (
              <tr key={i.id}>
                <td className="py-1">{i.description}</td>
                <td className="py-1 text-right">{i.quantity} × {fmtMoney(i.unit_price)}</td>
                <td className="py-1 text-right">{fmtMoney(i.quantity * i.unit_price)}</td>
              </tr>
            ))}
            {adjustment !== 0 && (
              <tr>
                <td className="py-1">{t("priceAdjustment")}</td>
                <td />
                <td className="py-1 text-right">{fmtMoney(adjustment)}</td>
              </tr>
            )}
            <tr className="font-semibold">
              <td className="py-1">{t("total")}</td>
              <td />
              <td className="py-1 text-right">{fmtMoney(b.total_price)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      {editable && b.channel === "hotel" && (
        <Card title={`${t("hotel")} · ${b.hotels?.name ?? ""}`}>
          <form action={updateHotelDetails} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={b.id} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("hotelCode")} hint={t("hotelCodeHint")}>
                <Input name="hotel_code" defaultValue={b.hotel_code ?? ""} required autoComplete="off" />
              </Field>
              <Field label={t("commissionPct")} hint={commission?.status === "paid" ? undefined : t("commissionPctHint")}>
                <Input
                  name="commission_pct"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  defaultValue={commission ? Number(commission.commission_pct) : ""}
                  disabled={!commission || commission.status === "paid"}
                  className="sm:max-w-[10rem]"
                />
              </Field>
            </div>
            {commission && (
              <p className="text-sm text-slate-700">
                {t("commission")}: <strong className="text-slate-900">{fmtMoney(commission.commission_amount)}</strong>{" "}
                <Badge tone={commission.status === "paid" ? "green" : commission.status === "owed" ? "amber" : "slate"}>
                  {t(`comm_${commission.status}`)}
                </Badge>
                {commission.paid_at && <> · {t("paidOn")} {fmtDate(`${commission.paid_at}T12:00:00${TZ_OFFSET}`, lang)}</>}
              </p>
            )}
            <div>
              <Button type="submit" variant="secondary">{t("saveHotelDetails")}</Button>
            </div>
          </form>
        </Card>
      )}

      {editable && b.channel !== "hotel" && hotels.length > 0 && (
        <Card title={t("makeHotelBooking")}>
          <form action={makeHotelBooking} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={b.id} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("hotel")}>
                <Select name="hotel_id" required defaultValue="">
                  <option value="" disabled>{t("chooseHotel")}</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({Number(h.default_commission_pct)}%)</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("hotelCode")} hint={t("hotelCodeHint")}>
                <Input name="hotel_code" required autoComplete="off" />
              </Field>
              <Field label={t("commissionPct")} hint={t("makeHotelPctHint")}>
                <Input name="commission_pct" type="number" min={0} max={100} step="0.01" className="sm:max-w-[10rem]" />
              </Field>
            </div>
            <div>
              <Button type="submit" variant="secondary">{t("makeHotelBooking")}</Button>
            </div>
          </form>
        </Card>
      )}

      <form action={updateBooking}>
        <input type="hidden" name="id" value={b.id} />
        <input type="hidden" name="customer_id" value={b.customer_id} />
        <fieldset disabled={!editable}>
          <Card title={t("customer")}>
            {(customerBookings ?? 0) > 1 && (
              <p className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200">
                {t("customerShared").replace("{n}", String(customerBookings))}
              </p>
            )}
            <Grid>
              <Field label={t("name")}><Input name="full_name" defaultValue={c.full_name} required /></Field>
              <Field label={t("phone")}><Input name="phone" defaultValue={c.phone ?? ""} /></Field>
              <Field label={t("email")}><Input name="email" type="email" defaultValue={c.email ?? ""} /></Field>
              <Field label={t("language")}>
                <Select name="language" defaultValue={c.language}>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </Select>
              </Field>
              <Field label={t("emergencyContact")}><Input name="emergency_contact_name" defaultValue={c.emergency_contact_name ?? ""} /></Field>
              <Field label={t("emergencyPhone")}><Input name="emergency_contact_phone" defaultValue={c.emergency_contact_phone ?? ""} /></Field>
            </Grid>
          </Card>
          <Card title={t("details")}>
            <Grid>
              <Field label={t("occasion")}><Input name="occasion" defaultValue={b.occasion ?? ""} placeholder={t("occasionHint")} /></Field>
              <Field label={t("total")}><Input name="total_price" type="number" step="0.01" min={0} defaultValue={b.total_price} /></Field>
              <Field label={t("specialRequests")}><Textarea name="special_requests" defaultValue={b.special_requests ?? ""} /></Field>
              <Field label={t("internalNotes")}><Textarea name="internal_notes" defaultValue={b.internal_notes ?? ""} /></Field>
              <Field label={t("pickupTime")}><Input name="pickup_time" type="time" defaultValue={b.pickup_time?.slice(0, 5) ?? ""} className="sm:max-w-[10rem]" /></Field>
              <Field label={t("pickupPlace")}><Input name="pickup_place" defaultValue={b.pickup_place ?? ""} placeholder={t("pickupPlaceHint")} /></Field>
              {b.channel === "ota" && (
                <>
                  <Field label={t("otaName")}><Input name="ota_name" defaultValue={b.ota_name ?? ""} /></Field>
                  <Field label={t("otaReference")}><Input name="ota_reference" defaultValue={b.ota_reference ?? ""} /></Field>
                </>
              )}
            </Grid>
            {editable && <Button type="submit" className="mt-4">{t("save")}</Button>}
          </Card>
        </fieldset>
      </form>

      {editable && b.status === "confirmed" && trip && (
        <Card title={t("changeGuests")}>
          <form action={changeGuests} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={b.id} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("guests")} group>
                <Stepper name="guests" defaultValue={b.guests} min={1} max={Math.max(maxGuests, b.guests)} unit="pax" label={t("guests")} {...sl} />
              </Field>
              {oneOffPrivate && (
                <>
                  <Field label={t("extraGuestPrice")} hint={prod?.base_guests ? `${t("paxIncluded")}: ${prod.base_guests}` : undefined}>
                    <MoneyInput name="extra_guest_price" defaultValue={prod?.extra_guest_price ?? ""} />
                  </Field>
                  <Field label={t("extraHours")} group>
                    <Stepper name="extra_hours" defaultValue={trip.extra_hours} min={0} max={12} unit="h" label={t("extraHours")} {...sl} />
                  </Field>
                  <Field label={t("extraHourPrice")}>
                    <MoneyInput name="extra_hour_price" defaultValue={prod?.extra_hour_price ?? ""} />
                  </Field>
                </>
              )}
              <Field label={t("priceOverride")} hint={t("changeGuestsHint")}>
                <MoneyInput name="total_override" />
              </Field>
            </div>
            <div>
              <Button type="submit">{t("saveChanges")}</Button>
            </div>
          </form>
        </Card>
      )}

      {editable && b.status === "confirmed" && trip && trip.status === "scheduled" && onlyThisTrip && (
        <Card title={t("editTrip")}>
          <EditTripForm trip={trip} boats={boats} back={`/bookings/${b.id}`} lang={lang} t={t} />
        </Card>
      )}

      {editable && b.status === "confirmed" && trip && !onlyThisTrip && (
        <Card title={t("reschedule")}>
          {options.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noTrips")}</p>
          ) : (
            <form action={rescheduleBooking} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={b.id} />
              <Field label={t("upcomingTrips")}>
                <Select name="departure_id" required>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {fmtDateTime(o.starts_at, lang)} · {o.boat_name} · {o.seats_left} {t("seatsLeft")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit">{t("move")}</Button>
            </form>
          )}
          <p className="mt-3 text-sm text-slate-600">
            {t("rescheduleWholeTrip")}{" "}
            <Link className="text-sky-700 underline" href={`/departures/${b.departure_id}`}>{t("editTrip")}</Link>
          </p>
        </Card>
      )}

      {editable && (
        <Card>
          <div className="flex flex-wrap gap-2">
            {b.status === "confirmed" && (
              <>
                {statusButton("completed", t("markCompleted"))}
                {statusButton("no_show", t("markNoShow"))}
                {statusButton("cancelled", t("cancelBooking"), "danger")}
              </>
            )}
            {b.status !== "confirmed" && statusButton("confirmed", t("reactivate"))}
          </div>
          {b.status === "confirmed" && onlyThisTrip && trip && trip.bookings_count <= 1 && (
            <p className="mt-2 text-xs text-slate-500">{t("cancelFreesBoat")}</p>
          )}
        </Card>
      )}

      {editable && (history ?? []).length > 0 && (
        <Card title={t("history")}>
          <ChangeHistory
            entries={(history ?? []) as unknown as Change[]}
            boats={new Map(boats.map((x) => [x.id, x.name]))}
            lang={lang}
            t={t}
          />
        </Card>
      )}
    </>
  );
}
