import { pageContext } from "@/lib/auth";
import { fmtDateTime, todayLocal } from "@/lib/format";
import { Badge, Button, Card, Field, Flash, Input, PageTitle, Select } from "@/components/ui";
import { addBlock, deleteBlock, saveBoat } from "./actions";

export default async function BoatsPage({ searchParams }: PageProps<"/boats">) {
  const sp = await searchParams;
  const { supabase, lang, t } = await pageContext(["admin"]);
  const [{ data: boats }, { data: blocks }] = await Promise.all([
    supabase.from("boats").select("*").order("name"),
    supabase.from("boat_blocks").select("*, boats(name)").gte("ends_at", new Date().toISOString()).order("starts_at"),
  ]);

  return (
    <>
      <PageTitle>{t("boats")}</PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />

      <Card>
        {(boats ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">{t("noResults")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(boats ?? []).map((b) => (
              <li key={b.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex-1 font-medium">{b.name}</span>
                    <span className="text-sm text-slate-600">{b.length_ft ? `${b.length_ft} ft` : ""}</span>
                    <span className="text-sm text-slate-600">{b.max_guests} {t("guests").toLowerCase()}</span>
                    {b.active ? <Badge tone="green">{t("active")}</Badge> : <Badge>{t("inactive")}</Badge>}
                    <span className="rounded-md border border-slate-300 px-3 py-1 text-sm">{t("edit")}</span>
                  </summary>
                  <div className="mt-3 rounded-md bg-slate-50 p-3">
                    <BoatForm boat={b} t={t} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("newBoat")}>
        <BoatForm t={t} />
      </Card>

      <Card title={t("blocks")}>
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {(blocks ?? []).map((bl) => (
            <li key={bl.id} className="flex flex-wrap items-center gap-3 py-2">
              <strong>{(bl.boats as { name: string } | null)?.name ?? t("allBoats")}</strong>
              <span>{fmtDateTime(bl.starts_at, lang)} – {fmtDateTime(bl.ends_at, lang)}</span>
              <span className="flex-1 text-slate-600">{bl.reason}</span>
              <form action={deleteBlock}>
                <input type="hidden" name="id" value={bl.id} />
                <Button variant="secondary" type="submit">{t("delete")}</Button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addBlock} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
          <Field label={t("boat")}>
            <Select name="boat_id">
              <option value="">{t("allBoats")}</option>
              {(boats ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("from")}>
            <Input type="datetime-local" name="starts_at" defaultValue={`${todayLocal()}T00:00`} required />
          </Field>
          <Field label={t("to")}>
            <Input type="datetime-local" name="ends_at" defaultValue={`${todayLocal()}T23:59`} required />
          </Field>
          <Field label={t("reason")}>
            <Input name="reason" required />
          </Field>
          <Button type="submit">{t("add")}</Button>
        </form>
      </Card>
    </>
  );
}

type BoatRow = { id: number; name: string; length_ft: number | null; max_guests: number; active: boolean; notes: string | null };

function BoatForm({ boat, t }: { boat?: BoatRow; t: import("@/lib/i18n").T }) {
  return (
    <form action={saveBoat} className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:items-end">
      {boat && <input type="hidden" name="id" value={boat.id} />}
      <div className="col-span-2">
        <Field label={t("name")}><Input name="name" defaultValue={boat?.name} required /></Field>
      </div>
      <Field label={t("lengthFt")}><Input name="length_ft" type="number" min={1} defaultValue={boat?.length_ft ?? ""} /></Field>
      <Field label={t("maxGuests")}><Input name="max_guests" type="number" min={1} defaultValue={boat?.max_guests} required /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={boat?.active ?? true} /> {t("active")}
      </label>
      <Button type="submit">{boat ? t("save") : t("add")}</Button>
    </form>
  );
}
