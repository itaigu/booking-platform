import Link from "next/link";
import { notFound } from "next/navigation";
import { canBook, pageContext } from "@/lib/auth";
import { fmtDateTime, fmtTime, fmtMoney, localDayOf } from "@/lib/format";
import { Badge, Button, ButtonLink, Card, Flash, PageTitle } from "@/components/ui";
import type { Availability } from "@/lib/types";
import { cancelTrip } from "./actions";

export default async function DeparturePage({ params, searchParams }: PageProps<"/departures/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, staff, lang, t } = await pageContext();

  const { data: trip } = await supabase.from("departure_availability").select("*").eq("id", id).maybeSingle<Availability>();
  if (!trip) notFound();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, booking_number, guests, status, channel, ota_name, occasion, special_requests, total_price, customers(full_name, phone, emergency_contact_name, emergency_contact_phone)")
    .eq("departure_id", id)
    .order("created_at");

  const name = lang === "es" ? trip.product_name_es : trip.product_name_en;
  const active = (bookings ?? []).filter((b) => b.status !== "cancelled");
  const scheduled = trip.status === "scheduled";

  return (
    <>
      <PageTitle
        actions={
          <>
            <ButtonLink variant="secondary" href={`/calendar?date=${localDayOf(trip.starts_at)}${sp.view === "week" ? "&view=week" : ""}`}>
              ‹ {t("calendar")}
            </ButtonLink>
            {canBook(staff.role) && scheduled && trip.seats_left > 0 && (
              <ButtonLink href={`/bookings/new?departure=${trip.id}`}>{t("bookThisTrip")}</ButtonLink>
            )}
          </>
        }
      >
        {name}
      </PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />

      <Card>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-slate-500">{t("date")}</dt><dd className="font-medium">{fmtDateTime(trip.starts_at, lang)} – {fmtTime(trip.ends_at, lang)}</dd></div>
          <div><dt className="text-slate-500">{t("boat")}</dt><dd className="font-medium">{trip.boat_name}</dd></div>
          <div><dt className="text-slate-500">{t("guests")}</dt><dd className="font-medium">{trip.guests_booked} / {trip.capacity}</dd></div>
          <div><dt className="text-slate-500">{t("status")}</dt><dd>
            {scheduled ? <Badge tone="green">{t("dep_scheduled")}</Badge> : <Badge tone="red">{t(`dep_${trip.status}`)}</Badge>}
          </dd></div>
        </dl>
      </Card>

      <Card title={`${t("manifest")} (${active.reduce((s, b) => s + (b.status === "confirmed" ? b.guests : 0), 0)})`}>
        {(bookings ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">{t("noResults")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-3">{t("bookingNumber")}</th>
                  <th className="py-2 pr-3">{t("customer")}</th>
                  <th className="py-2 pr-3">{t("guests")}</th>
                  <th className="py-2 pr-3">{t("channel")}</th>
                  <th className="py-2 pr-3">{t("specialRequests")}</th>
                  <th className="py-2 pr-3">{t("emergencyContact")}</th>
                  <th className="py-2 pr-3">{t("total")}</th>
                  <th className="py-2">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(bookings ?? []).map((b) => {
                  const c = b.customers as unknown as { full_name: string; phone: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null };
                  return (
                    <tr key={b.id} className={b.status === "cancelled" ? "opacity-50" : ""}>
                      <td className="py-2 pr-3"><Link className="text-sky-700 underline" href={`/bookings/${b.id}`}>{b.booking_number}</Link></td>
                      <td className="py-2 pr-3">{c?.full_name}<div className="text-xs text-slate-500">{c?.phone}</div></td>
                      <td className="py-2 pr-3">{b.guests}</td>
                      <td className="py-2 pr-3">{t(`channel_${b.channel}` as never)}{b.ota_name ? ` · ${b.ota_name}` : ""}</td>
                      <td className="py-2 pr-3">{[b.occasion, b.special_requests].filter(Boolean).join(" · ")}</td>
                      <td className="py-2 pr-3">{[c?.emergency_contact_name, c?.emergency_contact_phone].filter(Boolean).join(" · ")}</td>
                      <td className="py-2 pr-3">{fmtMoney(b.total_price)}</td>
                      <td className="py-2">{t(`status_${b.status}` as never)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canBook(staff.role) && scheduled && (
        <Card>
          {trip.bookings_count > 0 ? (
            <p className="text-sm text-slate-500">{t("cancelTrip")}: {t("cancelTripHasBookings")}</p>
          ) : (
            <form action={cancelTrip}>
              <input type="hidden" name="id" value={trip.id} />
              {sp.view === "week" && <input type="hidden" name="view" value="week" />}
              <Button variant="danger" type="submit">{t("cancelTrip")}</Button>
            </form>
          )}
        </Card>
      )}
    </>
  );
}
