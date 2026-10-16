import Link from "next/link";
import { isAdmin, pageContext } from "@/lib/auth";
import { commissionLines, totalsByHotel, type HotelTotals } from "@/lib/commissions";
import { addMonths, fmtDate, fmtMoney, fmtMonth, isMonth, todayLocal, TZ_OFFSET } from "@/lib/format";
import type { Lang, T } from "@/lib/i18n";
import { Badge, Button, ButtonLink, Card, DownloadLink, Field, Flash, Input, PageTitle } from "@/components/ui";
import { markPaid, undoPaid } from "./actions";

const tone = { owed: "amber", paid: "green", cancelled: "slate" } as const;
const day = (d: string, lang: Lang) => fmtDate(`${d}T12:00:00${TZ_OFFSET}`, lang);

export default async function CommissionsPage({ searchParams }: PageProps<"/commissions">) {
  const sp = await searchParams;
  const { supabase, staff, lang, t } = await pageContext(["admin", "office"]);
  const month = isMonth(sp.month as string) ? (sp.month as string) : todayLocal().slice(0, 7);
  const hotels = totalsByHotel(await commissionLines(supabase, month));
  const sum = (k: "bookings" | "sales" | "commission" | "owed" | "paid") =>
    Math.round(hotels.reduce((s, h) => s + h[k], 0) * 100) / 100;

  return (
    <>
      <PageTitle
        actions={
          hotels.length > 0 && (
            <DownloadLink href={`/commissions/export?month=${month}`}>{t("downloadCsv")}</DownloadLink>
          )
        }
      >
        {t("commissions")}
      </PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />
      <p className="mb-4 max-w-3xl text-sm text-slate-600">{t("commissionsIntro")}</p>

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/commissions">
        <ButtonLink variant="secondary" href={`/commissions?month=${addMonths(month, -1)}`} aria-label={t("previous")}>‹</ButtonLink>
        <Field label={t("month")}>
          <Input type="month" name="month" defaultValue={month} className="w-48" />
        </Field>
        <Button type="submit" variant="secondary">{t("showMonth")}</Button>
        <ButtonLink variant="secondary" href={`/commissions?month=${addMonths(month, 1)}`} aria-label={t("next")}>›</ButtonLink>
      </form>

      {hotels.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">{t("noCommissions")} ({fmtMonth(month, lang)})</p>
        </Card>
      ) : (
        <>
          <Card title={fmtMonth(month, lang)}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">{t("hotel")}</th>
                    <th className="py-2 pr-3 text-right">{t("bookings")}</th>
                    <th className="py-2 pr-3 text-right">{t("sales")}</th>
                    <th className="py-2 pr-3 text-right">{t("commission")}</th>
                    <th className="py-2 pr-3 text-right">{t("owed")}</th>
                    <th className="py-2 text-right">{t("paid")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {hotels.map((h) => (
                    <tr key={h.hotel_id}>
                      <td className="py-2 pr-3"><a className="text-sky-700 underline" href={`#hotel-${h.hotel_id}`}>{h.hotel_name}</a></td>
                      <td className="py-2 pr-3 text-right">{h.bookings}</td>
                      <td className="py-2 pr-3 text-right">{fmtMoney(h.sales)}</td>
                      <td className="py-2 pr-3 text-right font-medium">{fmtMoney(h.commission)}</td>
                      <td className="py-2 pr-3 text-right">{fmtMoney(h.owed)}</td>
                      <td className="py-2 text-right">{fmtMoney(h.paid)}</td>
                    </tr>
                  ))}
                </tbody>
                {hotels.length > 1 && (
                  <tfoot className="border-t border-slate-300 font-semibold tabular-nums">
                    <tr>
                      <th scope="row" className="py-2 pr-3">{t("total")}</th>
                      <td className="py-2 pr-3 text-right">{sum("bookings")}</td>
                      <td className="py-2 pr-3 text-right">{fmtMoney(sum("sales"))}</td>
                      <td className="py-2 pr-3 text-right">{fmtMoney(sum("commission"))}</td>
                      <td className="py-2 pr-3 text-right">{fmtMoney(sum("owed"))}</td>
                      <td className="py-2 text-right">{fmtMoney(sum("paid"))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          {hotels.map((h) => (
            <HotelCard key={h.hotel_id} h={h} month={month} admin={isAdmin(staff.role)} lang={lang} t={t} />
          ))}
        </>
      )}
    </>
  );
}

function HotelCard({ h, month, admin, lang, t }: { h: HotelTotals; month: string; admin: boolean; lang: Lang; t: T }) {
  const now = new Date();
  const hasPaid = h.lines.some((l) => l.status === "paid");
  return (
    <section id={`hotel-${h.hotel_id}`} className="scroll-mt-20">
      <Card title={h.hotel_name}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-3">{t("date")}</th>
                <th className="py-2 pr-3">{t("trip")}</th>
                <th className="py-2 pr-3">{t("bookingNumber")}</th>
                <th className="py-2 pr-3">{t("hotelCode")}</th>
                <th className="py-2 pr-3">{t("customer")}</th>
                <th className="py-2 pr-3 text-right">{t("guests")}</th>
                <th className="py-2 pr-3 text-right">{t("total")}</th>
                <th className="py-2 pr-3 text-right">%</th>
                <th className="py-2 pr-3 text-right">{t("commission")}</th>
                <th className="py-2">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {h.lines.map((l) => (
                <tr key={l.booking_id} className={l.status === "cancelled" ? "text-slate-400" : ""}>
                  <td className="py-2 pr-3 whitespace-nowrap">{day(l.trip_day, lang)}</td>
                  <td className="py-2 pr-3">{lang === "es" ? l.product_name_es : l.product_name_en}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Link className="text-sky-700 underline" href={`/bookings/${l.booking_id}`}>{l.booking_number}</Link>
                  </td>
                  <td className="py-2 pr-3 font-mono whitespace-nowrap">{l.hotel_code}</td>
                  <td className="py-2 pr-3">{l.customer_name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{l.guests}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(l.total_price)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{Number(l.commission_pct)}</td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${l.status === "cancelled" ? "line-through" : "font-medium"}`}>
                    {fmtMoney(l.commission_amount)}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <Badge tone={tone[l.status]}>{t(`comm_${l.status}`)}</Badge>
                    {l.status === "paid" && l.paid_at && <div className="text-xs text-slate-500">{day(l.paid_at, lang)}</div>}
                    {l.status === "owed" && new Date(l.starts_at) > now && <div className="text-xs text-slate-500">{t("notYet")}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-300 font-semibold tabular-nums">
              <tr>
                <th scope="row" colSpan={6} className="py-2 pr-3">{t("total")}</th>
                <td className="py-2 pr-3 text-right">{fmtMoney(h.sales)}</td>
                <td />
                <td className="py-2 pr-3 text-right">{fmtMoney(h.commission)}</td>
                <td className="py-2 text-xs font-normal text-slate-600">
                  {t("owed")} {fmtMoney(h.owed)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-end">
          {h.payable > 0 && (
            <form action={markPaid} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="hotel_id" value={h.hotel_id} />
              <input type="hidden" name="month" value={month} />
              <Field label={t("paymentDate")} hint={t("markPaidHint")}>
                <Input type="date" name="paid_at" defaultValue={todayLocal()} required className="w-48" />
              </Field>
              <Button type="submit">{t("markPaid")}</Button>
            </form>
          )}
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <DownloadLink href={`/commissions/export?month=${month}&hotel=${h.hotel_id}`}>{t("downloadCsv")}</DownloadLink>
            {admin && hasPaid && (
              <form action={undoPaid}>
                <input type="hidden" name="hotel_id" value={h.hotel_id} />
                <input type="hidden" name="month" value={month} />
                <Button type="submit" variant="secondary">{t("undoPaid")}</Button>
              </form>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
