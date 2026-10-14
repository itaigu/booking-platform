import { notFound } from "next/navigation";
import { pageContext } from "@/lib/auth";
import { fmtMoney } from "@/lib/format";
import { TourFields, type Product } from "@/components/tour-fields";
import { Button, ButtonLink, Card, Field, Flash, Input, PageTitle, Select } from "@/components/ui";
import { addPriceRule, deletePriceRule, saveBoatsForTour, saveTicketType, saveTour } from "../actions";

export default async function TourPage({ params, searchParams }: PageProps<"/tours/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, t } = await pageContext(["admin"]);

  const [{ data: p }, { data: tickets }, { data: boats }, { data: linked }, { data: rules }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle<Product>(),
    supabase.from("ticket_types").select("*").eq("product_id", id).order("id"),
    supabase.from("boats").select("id, name, max_guests").order("name"),
    supabase.from("product_boats").select("boat_id").eq("product_id", id),
    supabase.from("price_rules").select("*").eq("product_id", id).order("starts_on"),
  ]);
  if (!p) notFound();
  const linkedIds = new Set((linked ?? []).map((l) => l.boat_id));
  const ticketName = (tid: number | null) => (tickets ?? []).find((x) => x.id === tid)?.name_en ?? t("wholeTour");

  return (
    <>
      <PageTitle actions={<ButtonLink variant="secondary" href="/tours">‹ {t("tours")}</ButtonLink>}>{p.name_en}</PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />

      <Card title={t("details")}>
        <form action={saveTour}>
          <input type="hidden" name="id" value={p.id} />
          <TourFields p={p} t={t} />
          <Button type="submit" className="mt-4">{t("save")}</Button>
        </form>
      </Card>

      <Card title={t("whichBoats")}>
        <form action={saveBoatsForTour} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="product_id" value={p.id} />
          {(boats ?? []).map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="boat_id" value={b.id} defaultChecked={linkedIds.has(b.id)} />
              {b.name} ({b.max_guests})
            </label>
          ))}
          <Button type="submit">{t("save")}</Button>
        </form>
      </Card>

      {p.kind === "shared" && (
        <Card title={t("ticketTypes")}>
          <div className="space-y-3">
            {[...(tickets ?? []), null].map((tt) => (
              <form key={tt?.id ?? "new"} action={saveTicketType} className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end">
                <input type="hidden" name="product_id" value={p.id} />
                {tt && <input type="hidden" name="id" value={tt.id} />}
                <Field label={t("nameEn")}><Input name="name_en" defaultValue={tt?.name_en} placeholder="Adult" required /></Field>
                <Field label={t("nameEs")}><Input name="name_es" defaultValue={tt?.name_es} placeholder="Adulto" required /></Field>
                <Field label={t("price")}><Input name="price" type="number" step="0.01" min={0} defaultValue={tt?.price} required /></Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={tt?.active ?? true} /> {t("active")}
                </label>
                <Button type="submit" variant={tt ? "secondary" : "primary"}>{tt ? t("save") : t("add")}</Button>
              </form>
            ))}
          </div>
        </Card>
      )}

      <Card title={t("priceRules")}>
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {(rules ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
              <strong>{r.label}</strong>
              <span>{r.starts_on} → {r.ends_on}</span>
              <span>{ticketName(r.ticket_type_id)}</span>
              <span className="flex-1">{r.price !== null ? fmtMoney(r.price) : `-${r.percent_off}%`}</span>
              <form action={deletePriceRule}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="product_id" value={p.id} />
                <Button variant="secondary" type="submit">{t("delete")}</Button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addPriceRule} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
          <input type="hidden" name="product_id" value={p.id} />
          <Field label={t("label")}><Input name="label" placeholder="High season / Sale -30%" required /></Field>
          <Field label={t("appliesTo")}>
            <Select name="ticket_type_id">
              <option value="">{t("wholeTour")}</option>
              {(tickets ?? []).map((tt) => (
                <option key={tt.id} value={tt.id}>{tt.name_en}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("from")}><Input name="starts_on" type="date" required /></Field>
          <Field label={t("to")}><Input name="ends_on" type="date" required /></Field>
          <Field label={t("percentOff")}><Input name="percent_off" type="number" step="0.01" min={0} max={100} /></Field>
          <Field label={t("fixedPrice")}><Input name="price" type="number" step="0.01" min={0} /></Field>
          <Button type="submit">{t("add")}</Button>
        </form>
      </Card>
    </>
  );
}
