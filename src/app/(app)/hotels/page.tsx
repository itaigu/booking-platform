import { pageContext } from "@/lib/auth";
import type { T } from "@/lib/i18n";
import type { Hotel } from "@/lib/types";
import { AddToggle, Badge, Button, Card, Field, Flash, Input, PageTitle } from "@/components/ui";
import { saveHotel } from "./actions";

export default async function HotelsPage({ searchParams }: PageProps<"/hotels">) {
  const sp = await searchParams;
  const { supabase, t } = await pageContext(["admin"]);
  const adding = sp.add === "1";
  const { data } = await supabase.from("hotels").select("*").order("name");
  const hotels = (data ?? []) as Hotel[];

  return (
    <>
      <PageTitle actions={<AddToggle href="/hotels" open={adding} label={t("newHotel")} closeLabel={t("close")} />}>{t("hotels")}</PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />
      <p className="mb-4 max-w-3xl text-sm text-slate-600">{t("hotelsIntro")}</p>

      {adding && (
        <Card title={t("newHotel")}>
          <HotelForm t={t} />
        </Card>
      )}

      <Card>
        {hotels.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noHotels")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {hotels.map((h) => (
              <li key={h.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex-1 font-medium">{h.name}</span>
                    <span className="text-sm text-slate-600">{[h.contact_name, h.phone].filter(Boolean).join(" · ")}</span>
                    <span className="text-sm font-medium text-slate-900 tabular-nums">{Number(h.default_commission_pct)} %</span>
                    {h.active ? <Badge tone="green">{t("active")}</Badge> : <Badge>{t("inactive")}</Badge>}
                    <span className="rounded-md border border-slate-300 px-3 py-1 text-sm">{t("edit")}</span>
                  </summary>
                  <div className="mt-3 rounded-md bg-slate-50 p-3">
                    <HotelForm hotel={h} t={t} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function HotelForm({ hotel, t }: { hotel?: Hotel; t: T }) {
  return (
    <form action={saveHotel} className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
      {hotel && <input type="hidden" name="id" value={hotel.id} />}
      <div className="sm:col-span-3">
        <Field label={t("name")}><Input name="name" defaultValue={hotel?.name} required autoComplete="off" /></Field>
      </div>
      <div className="sm:col-span-3">
        <Field label={t("contactName")}><Input name="contact_name" defaultValue={hotel?.contact_name ?? ""} autoComplete="off" /></Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={t("phone")}><Input name="phone" type="tel" defaultValue={hotel?.phone ?? ""} autoComplete="off" /></Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={t("email")}><Input name="email" type="email" defaultValue={hotel?.email ?? ""} autoComplete="off" /></Field>
      </div>
      <Field label={t("defaultCommission")}>
        <Input name="default_commission_pct" type="number" min={0} max={100} step="0.01" defaultValue={hotel ? Number(hotel.default_commission_pct) : ""} required />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={hotel?.active ?? true} /> {t("active")}
      </label>
      <div className="sm:col-span-6">
        <Button type="submit">{hotel ? t("save") : t("add")}</Button>
      </div>
    </form>
  );
}
