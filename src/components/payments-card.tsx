import { createPaymentLink, cancelPaymentLink, deletePayment, recordPayment } from "@/app/(app)/bookings/payments";
import type { Role } from "@/lib/auth";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import type { Key, Lang, T } from "@/lib/i18n";
import { CopyLink } from "./copy-link";
import { Badge, Button, Card, Field, Input, MoneyInput, Select } from "./ui";

export type Payment = {
  id: number;
  kind: "payment" | "refund" | "tip";
  method: "stripe" | "cash" | "card_at_dock" | "other";
  amount: number;
  note: string | null;
  created_at: string;
  staff: { full_name: string } | null;
};

export type PaymentLink = {
  id: number;
  amount: number;
  url: string;
  status: "open" | "paid" | "cancelled";
  created_at: string;
  paid_at: string | null;
};

const linkTone = { open: "amber", paid: "green", cancelled: "slate" } as const;

// What was paid on a booking, its Stripe payment links, and payments taken in person.
export function PaymentsCard({
  bookingId,
  total,
  confirmed,
  phone,
  payments,
  links,
  role,
  stripeReady,
  lang,
  t,
}: {
  bookingId: number;
  total: number;
  confirmed: boolean;
  phone: string | null;
  payments: Payment[];
  links: PaymentLink[];
  role: Role;
  stripeReady: boolean;
  lang: Lang;
  t: T;
}) {
  const sum = (kind: Payment["kind"]) => payments.filter((p) => p.kind === kind).reduce((s, p) => s + Number(p.amount), 0);
  const paid = Math.round((sum("payment") - sum("refund")) * 100) / 100;
  const tips = sum("tip");
  const due = Math.round((total - paid) * 100) / 100;
  const office = role === "admin" || role === "office";
  const hidden = <input type="hidden" name="id" value={bookingId} />;

  return (
    <Card title={t("payments")}>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div><dt className="text-slate-500">{t("total")}</dt><dd className="font-medium">{fmtMoney(total)}</dd></div>
        <div><dt className="text-slate-500">{t("paid")}</dt><dd className="font-medium">{fmtMoney(paid)}</dd></div>
        <div>
          <dt className="text-slate-500">{t("balanceDue")}</dt>
          <dd className="font-medium">
            {due > 0 ? fmtMoney(due) : <Badge tone="green">{t("fullyPaid")}</Badge>}
          </dd>
        </div>
      </dl>

      <table className="mt-4 w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {payments.length === 0 && (
            <tr><td className="py-1 text-slate-500">{t("noPayments")}</td></tr>
          )}
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="py-1.5">
                {t(`kind_${p.kind}` as Key)} · {t(`method_${p.method}` as Key)}
                <div className="text-xs text-slate-500">
                  {fmtDateTime(p.created_at, lang)}
                  {p.staff ? ` · ${p.staff.full_name}` : ""}
                  {p.note && p.method !== "stripe" ? ` · ${p.note}` : ""}
                </div>
              </td>
              <td className="py-1.5 text-right font-medium">
                {p.kind === "refund" ? "−" : ""}
                {fmtMoney(p.amount)}
              </td>
              {role === "admin" && (
                <td className="w-0 py-1.5 pl-2 text-right">
                  {p.method !== "stripe" && (
                    <form action={deletePayment}>
                      {hidden}
                      <input type="hidden" name="payment_id" value={p.id} />
                      <button type="submit" className="text-xs text-red-700 underline">{t("delete")}</button>
                    </form>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {tips > 0 && <p className="mt-2 text-sm text-slate-600">{t("tips")}: {fmtMoney(tips)}</p>}

      {office && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">{t("paymentLinks")}</h3>
          {!stripeReady ? (
            <p className="text-sm text-amber-800">{t("stripeNotSetUp")}</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600">{t("linkHint")}</p>
              <ul className="mb-4 space-y-3">
                {links.map((l) => (
                  <li key={l.id} className="rounded-md border border-slate-200 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <strong>{fmtMoney(l.amount)}</strong>{" "}
                        <Badge tone={linkTone[l.status]}>{t(`link_${l.status}` as Key)}</Badge>
                      </span>
                      <span className="text-xs text-slate-500">
                        {fmtDateTime(l.paid_at ?? l.created_at, lang)}
                      </span>
                    </div>
                    {l.status === "open" && (
                      <div className="flex flex-col gap-2">
                        <CopyLink
                          url={l.url}
                          phone={phone}
                          message={t("whatsAppText")}
                          labels={{ copy: t("copy"), copied: t("copied"), whatsApp: t("sendWhatsApp") }}
                        />
                        <form action={cancelPaymentLink}>
                          {hidden}
                          <input type="hidden" name="link_id" value={l.id} />
                          <button type="submit" className="text-xs text-red-700 underline">{t("cancelLink")}</button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {confirmed && due > 0 && (
                <form action={createPaymentLink} className="flex flex-wrap items-end gap-2">
                  {hidden}
                  <Field label={t("amount")} hint={t("linkAmountHint")}>
                    <MoneyInput name="amount" defaultValue={due} min={0.01} max={due} required />
                  </Field>
                  <Button type="submit">{t("createLink")}</Button>
                </form>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-slate-200 pt-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">{t("recordPayment")}</h3>
        <form action={recordPayment} className="flex flex-col gap-4">
          {hidden}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t("method")}>
              <Select name="method" defaultValue="cash">
                {(["cash", "card_at_dock", "other"] as const).map((m) => (
                  <option key={m} value={m}>{t(`method_${m}`)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("paymentKind")}>
              <Select name="kind" defaultValue="payment">
                {(["payment", "tip", "refund"] as const).map((k) => (
                  <option key={k} value={k}>{t(`kind_${k}`)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("amount")}>
              <MoneyInput name="amount" min={0.01} required />
            </Field>
          </div>
          <Field label={t("notes")}>
            <Input name="note" autoComplete="off" />
          </Field>
          <div>
            <Button type="submit" variant="secondary">{t("recordPaymentBtn")}</Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
