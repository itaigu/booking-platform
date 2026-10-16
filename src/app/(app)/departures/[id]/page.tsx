import Link from "next/link";
import { notFound } from "next/navigation";
import { canBook, pageContext } from "@/lib/auth";
import { fmtDateTime, fmtTime, fmtMoney, localDayOf } from "@/lib/format";
import { EditTripForm } from "@/components/edit-trip-form";
import { TripCrewForm } from "@/components/trip-crew-form";
import { Badge, Button, ButtonLink, Card, Field, Flash, PageTitle, Select } from "@/components/ui";
import type { Availability } from "@/lib/types";
import { cancelTrip } from "./actions";

type ManifestRow = {
  booking_id: number;
  booking_number: string;
  guests: number;
  status: string;
  channel: string;
  ota_name: string | null;
  occasion: string | null;
  special_requests: string | null;
  full_name: string;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  // empty for captains and crew
  total_price: number | null;
};

export default async function DeparturePage({ params, searchParams }: PageProps<"/departures/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, staff, lang, t } = await pageContext();

  const { data: trip } = await supabase.from("departure_availability").select("*").eq("id", id).maybeSingle<Availability>();
  if (!trip) notFound();

  // The guest list comes from trip_manifest, which hides prices from captains and crew.
  const [{ data: manifest }, { data: boats }, { data: dep }] = await Promise.all([
    supabase.rpc("trip_manifest", { p_departure_id: Number(id) }),
    supabase.from("boats").select("id, name, max_guests, active").order("name"),
    supabase.from("departures").select("crew").eq("id", id).maybeSingle<{ crew: string | null }>(),
  ]);
  const bookings = (manifest ?? []) as ManifestRow[];

  const name = lang === "es" ? trip.product_name_es : trip.product_name_en;
  const scheduled = trip.status === "scheduled";
  const editable = canBook(staff.role);
  const crew = staff.role === "crew";
  const back = `/departures/${trip.id}${sp.view === "week" ? "?view=week" : ""}`;

  return (
    <>
      <PageTitle
        actions={
          <>
            <ButtonLink variant="secondary" href={`/calendar?date=${localDayOf(trip.starts_at)}${sp.view === "week" ? "&view=week" : ""}`}>
              ‹ {t("calendar")}
            </ButtonLink>
            {editable && scheduled && trip.seats_left > 0 && (
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
          <div><dt className="text-slate-500">{t("boat")}</dt><dd className="font-medium">{trip.boat_name}{dep?.crew && <div className="font-normal text-slate-600">{dep.crew}</div>}</dd></div>
          <div><dt className="text-slate-500">{t("guests")}</dt><dd className="font-medium">{trip.guests_booked} / {trip.capacity}</dd></div>
          <div><dt className="text-slate-500">{t("status")}</dt><dd>
            {scheduled ? <Badge tone="green">{t("dep_scheduled")}</Badge> : <Badge tone="red">{t(`dep_${trip.status}`)}</Badge>}
          </dd></div>
        </dl>
      </Card>

      <Card title={`${t("manifest")} (${bookings.reduce((s, b) => s + (b.status === "confirmed" ? b.guests : 0), 0)})`}>
        {bookings.length === 0 ? (
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
                  {!crew && <th className="py-2 pr-3">{t("total")}</th>}
                  <th className="py-2">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => {
                  return (
                    <tr key={b.booking_id} className={b.status === "cancelled" ? "opacity-50" : ""}>
                      <td className="py-2 pr-3">
                        {crew ? b.booking_number : <Link className="text-sky-700 underline" href={`/bookings/${b.booking_id}`}>{b.booking_number}</Link>}
                      </td>
                      <td className="py-2 pr-3">{b.full_name}<div className="text-xs text-slate-500">{b.phone}</div></td>
                      <td className="py-2 pr-3">{b.guests}</td>
                      <td className="py-2 pr-3">{t(`channel_${b.channel}` as never)}{b.ota_name ? ` · ${b.ota_name}` : ""}</td>
                      <td className="py-2 pr-3">{[b.occasion, b.special_requests].filter(Boolean).join(" · ")}</td>
                      <td className="py-2 pr-3">{[b.emergency_contact_name, b.emergency_contact_phone].filter(Boolean).join(" · ")}</td>
                      {!crew && <td className="py-2 pr-3">{fmtMoney(b.total_price)}</td>}
                      <td className="py-2">{t(`status_${b.status}` as never)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editable && scheduled && <TripCrewForm departureId={trip.id} crew={dep?.crew ?? null} back={back} t={t} />}

      {editable && scheduled && (
        <Card title={t("editTrip")}>
          <EditTripForm trip={trip} boats={boats ?? []} back={back} lang={lang} t={t} />
        </Card>
      )}

      {editable && scheduled && (
        <Card title={t("cancelTrip")}>
          <form action={cancelTrip} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={trip.id} />
            <input type="hidden" name="bookings" value={trip.bookings_count} />
            {sp.view === "week" && <input type="hidden" name="view" value="week" />}
            <Field label={t("reason")}>
              <Select name="reason" defaultValue="weather" className="sm:max-w-xs">
                <option value="weather">{t("reasonWeather")}</option>
                <option value="other">{t("reasonOther")}</option>
              </Select>
            </Field>
            {trip.bookings_count > 0 && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirm" required className="mt-1" />
                <span>{t("cancelTripConfirm").replace("{n}", String(trip.bookings_count))}</span>
              </label>
            )}
            <div>
              <Button variant="danger" type="submit">{t("cancelTrip")}</Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
