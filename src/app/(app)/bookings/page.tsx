import Link from "next/link";
import { canBook, pageContext } from "@/lib/auth";
import { addDays, dayStart, fmtDateTime, fmtMoney, isDay } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Button, ButtonLink, Card, Field, Input, PageTitle } from "@/components/ui";

type Row = {
  id: number;
  booking_number: string;
  guests: number;
  status: string;
  channel: string;
  total_price: number;
  hotel_code: string | null;
  hotels: { name: string } | null;
  customers: { full_name: string; email: string | null; phone: string | null } | null;
  departures: { starts_at: string; products: { name_en: string; name_es: string } | null } | null;
};

const select =
  "id, booking_number, guests, status, channel, total_price, hotel_code, hotels(name), customers(full_name, email, phone), departures!inner(starts_at, products(name_en, name_es))";

export default async function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  const sp = await searchParams;
  const { supabase, staff, lang, t } = await pageContext(["admin", "office", "dock"]);
  const q = ((sp.q as string) ?? "").trim();
  const date = isDay(sp.date as string) ? (sp.date as string) : "";

  let query = supabase.from("bookings").select(select).order("created_at", { ascending: false }).limit(100);
  if (date) {
    query = query.gte("departures.starts_at", dayStart(date)).lt("departures.starts_at", dayStart(addDays(date, 1)));
  }
  if (q) {
    const like = `%${q.replace(/[%,()]/g, " ")}%`;
    const { data: customers } = await supabase
      .from("customers")
      .select("id")
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(200);
    const ids = (customers ?? []).map((c) => c.id);
    const ors = [`booking_number.ilike.${like}`, `ota_reference.ilike.${like}`, `hotel_code.ilike.${like}`];
    if (ids.length) ors.push(`customer_id.in.(${ids.join(",")})`);
    query = query.or(ors.join(","));
  }
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageTitle actions={canBook(staff.role) && <ButtonLink href="/bookings/new">{t("newBooking")}</ButtonLink>}>
        {t("bookings")}
      </PageTitle>

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/bookings">
        <Field label={t("search")}>
          <Input name="q" defaultValue={q} placeholder={t("searchHint")} className="w-72" />
        </Field>
        <Field label={t("date")}>
          <Input type="date" name="date" defaultValue={date} />
        </Field>
        <Button type="submit" variant="secondary">{t("search")}</Button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noResults")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-3">{t("bookingNumber")}</th>
                  <th className="py-2 pr-3">{t("customer")}</th>
                  <th className="py-2 pr-3">{t("trip")}</th>
                  <th className="py-2 pr-3">{t("guests")}</th>
                  <th className="py-2 pr-3">{t("channel")}</th>
                  <th className="py-2 pr-3">{t("total")}</th>
                  <th className="py-2">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-3"><Link className="text-sky-700 underline" href={`/bookings/${b.id}`}>{b.booking_number}</Link></td>
                    <td className="py-2 pr-3">{b.customers?.full_name}<div className="text-xs text-slate-500">{b.customers?.email ?? b.customers?.phone}</div></td>
                    <td className="py-2 pr-3">
                      {lang === "es" ? b.departures?.products?.name_es : b.departures?.products?.name_en}
                      <div className="text-xs text-slate-500">{b.departures && fmtDateTime(b.departures.starts_at, lang)}</div>
                    </td>
                    <td className="py-2 pr-3">{b.guests}</td>
                    <td className="py-2 pr-3">
                      {b.hotels ? b.hotels.name : t(`channel_${b.channel}` as never)}
                      {b.hotel_code && <div className="font-mono text-xs text-slate-500">{b.hotel_code}</div>}
                    </td>
                    <td className="py-2 pr-3">{fmtMoney(b.total_price)}</td>
                    <td className="py-2"><StatusBadge status={b.status} label={t(`status_${b.status}` as never)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
