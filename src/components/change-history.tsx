import { fmtDateTime, fmtMoney } from "@/lib/format";
import type { Key, Lang, T } from "@/lib/i18n";

export type Change = {
  id: number;
  table_name: string;
  action: "insert" | "update" | "delete";
  changes: Record<string, [unknown, unknown]>;
  changed_at: string;
  staff: { full_name: string } | null;
};

// Field names in the history, with the label to show.
const labels: Record<string, Key> = {
  guests: "guests",
  total_price: "total",
  status: "status",
  occasion: "occasion",
  special_requests: "specialRequests",
  internal_notes: "internalNotes",
  ota_name: "otaName",
  ota_reference: "otaReference",
  departure_id: "trip",
  customer_id: "customer",
  full_name: "name",
  phone: "phone",
  email: "email",
  language: "language",
  emergency_contact_name: "emergencyContact",
  emergency_contact_phone: "emergencyPhone",
  starts_at: "histStartsAt",
  ends_at: "histEndsAt",
  boat_id: "boat",
  amount: "total",
  hotel_code: "hotelCode",
  commission_pct: "commissionPct",
  commission_amount: "commission",
  paid_at: "paidOn",
};
const money = new Set(["total_price", "amount", "commission_amount"]);
const times = new Set(["starts_at", "ends_at"]);

// What changed on a booking, its trip and its customer, newest first.
export function ChangeHistory({
  entries,
  boats,
  lang,
  t,
}: {
  entries: Change[];
  boats: Map<number, string>;
  lang: Lang;
  t: T;
}) {
  const show = (table: string, field: string, v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (money.has(field)) return fmtMoney(v as number);
    if (times.has(field) || (table === "payment_links" && field === "paid_at")) return fmtDateTime(String(v), lang);
    if (field === "boat_id") return boats.get(Number(v)) ?? String(v);
    if (field === "status") {
      const group = table === "departures" ? "dep" : table === "commissions" ? "comm" : table === "payment_links" ? "link" : "status";
      return t(`${group}_${v}` as Key) ?? String(v);
    }
    const s = String(v);
    return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  };
  const prefix = (table: string, field: string) =>
    table === "departures"
      ? `${t("trip")} · `
      : table === "customers"
        ? `${t("customer")} · `
        : table === "commissions" && (field === "status" || field === "paid_at")
          ? `${t("commission")} · `
          : table === "payment_links"
            ? `${t("paymentLink")} · `
            : "";
  const created = (table: string) =>
    t(
      table === "bookings"
        ? "histCreated"
        : table === "payments"
          ? "histPayment"
          : table === "commissions"
            ? "histCommission"
            : table === "payment_links"
              ? "histPaymentLink"
              : "histAdded",
    );

  return (
    <ol className="space-y-3 text-sm">
      {entries.map((e) => (
        <li key={e.id} className="border-b border-slate-100 pb-2 last:border-0">
          <div className="text-xs text-slate-500">
            {fmtDateTime(e.changed_at, lang)}
            {e.staff ? ` · ${e.staff.full_name}` : ""}
          </div>
          {e.action === "insert" ? (
            <div>{created(e.table_name)}</div>
          ) : e.action === "delete" ? (
            <div>{t("histDeleted")}</div>
          ) : (
            <ul>
              {Object.entries(e.changes).map(([field, [from, to]]) => (
                <li key={field}>
                  <span className="text-slate-600">
                    {prefix(e.table_name, field)}
                    {labels[field] ? t(labels[field]) : field}:
                  </span>{" "}
                  {field === "departure_id" ? (
                    t("histMoved")
                  ) : (
                    <>
                      <span className="text-slate-500 line-through">{show(e.table_name, field, from)}</span> →{" "}
                      <span className="font-medium text-slate-900">{show(e.table_name, field, to)}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
