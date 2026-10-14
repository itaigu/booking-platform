import Link from "next/link";
import { notFound } from "next/navigation";
import { canBook, pageContext } from "@/lib/auth";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import type { Availability } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Button, ButtonLink, Card, Field, Flash, Grid, Input, PageTitle, Select, Textarea } from "@/components/ui";
import { rescheduleBooking, setBookingStatus, updateBooking } from "../actions";

type Booking = {
  id: number;
  booking_number: string;
  departure_id: number;
  customer_id: number;
  channel: string;
  ota_name: string | null;
  ota_reference: string | null;
  hotel_code: string | null;
  guests: number;
  total_price: number;
  status: string;
  occasion: string | null;
  special_requests: string | null;
  internal_notes: string | null;
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
};

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, staff, lang, t } = await pageContext();

  const { data } = await supabase
    .from("bookings")
    .select("*, customers(*), booking_items(*), staff(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const b = data as unknown as Booking;

  const { data: trip } = await supabase.from("departure_availability").select("*").eq("id", b.departure_id).single<Availability>();
  const editable = canBook(staff.role);

  // Other upcoming trips of the same tour with room for this group.
  let options: Availability[] = [];
  if (editable && b.status === "confirmed" && trip) {
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
            <dd className="font-medium">{t(`channel_${b.channel}` as never)}{b.ota_name ? ` · ${b.ota_name}` : ""}{b.ota_reference ? ` (${b.ota_reference})` : ""}</dd>
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
            <tr className="font-semibold">
              <td className="py-1">{t("total")}</td>
              <td />
              <td className="py-1 text-right">{fmtMoney(b.total_price)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <form action={updateBooking}>
        <input type="hidden" name="id" value={b.id} />
        <input type="hidden" name="customer_id" value={b.customer_id} />
        <fieldset disabled={!editable}>
          <Card title={t("customer")}>
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

      {editable && b.status === "confirmed" && (
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
        </Card>
      )}
    </>
  );
}
