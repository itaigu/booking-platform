import { TimePicker } from "@/components/time-picker";
import { pageContext } from "@/lib/auth";
import { addDays, todayLocal } from "@/lib/format";
import type { Key } from "@/lib/i18n";
import { AddToggle, Badge, Button, Card, Field, Flash, Input, PageTitle, Select } from "@/components/ui";
import { deleteSchedule, generateTrips, saveSchedule } from "./actions";

const dayKeys: Key[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export default async function SchedulesPage({ searchParams }: PageProps<"/schedules">) {
  const sp = await searchParams;
  const { supabase, lang, t } = await pageContext(["admin"]);
  const adding = sp.add === "1";
  const [{ data: schedules }, { data: products }, { data: boats }] = await Promise.all([
    supabase.from("schedules").select("*, products(name_en, name_es), boats(name)").order("start_time"),
    supabase.from("products").select("id, name_en, name_es").eq("active", true).order("name_en"),
    supabase.from("boats").select("id, name").eq("active", true).order("name"),
  ]);
  const today = todayLocal();

  return (
    <>
      <PageTitle actions={<AddToggle href="/schedules" open={adding} label={t("newSchedule")} />}>{t("schedules")}</PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />

      {adding && (
        <Card title={t("newSchedule")}>
          <form action={saveSchedule} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("tour")}>
                <Select name="product_id" required>
                  {(products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{lang === "es" ? p.name_es : p.name_en}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("boat")}>
                <Select name="boat_id">
                  <option value="">{t("anyBoat")}</option>
                  {(boats ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("startTime")} group className="sm:col-span-3 sm:max-w-md"><TimePicker name="start_time" /></Field>
              <Field label={t("validFrom")}><Input type="date" name="valid_from" defaultValue={today} required /></Field>
              <Field label={t("validTo")}><Input type="date" name="valid_to" /></Field>
            </div>
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="mb-1 font-medium text-slate-700">{t("weekdays")}</legend>
              {dayKeys.map((k, i) => (
                <label key={k} className="flex items-center gap-1">
                  <input type="checkbox" name="weekdays" value={i} defaultChecked /> {t(k)}
                </label>
              ))}
            </fieldset>
            <Button type="submit">{t("add")}</Button>
          </form>
        </Card>
      )}

      {(schedules ?? []).map((s) => {
        const prod = s.products as { name_en: string; name_es: string } | null;
        return (
          <Card key={s.id}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <strong className="flex-1">
                {lang === "es" ? prod?.name_es : prod?.name_en} · {String(s.start_time).slice(0, 5)}
              </strong>
              <span className="text-sm">{(s.weekdays as number[]).map((d) => t(dayKeys[d])).join(", ")}</span>
              <span className="text-sm text-slate-600">{(s.boats as { name: string } | null)?.name ?? t("anyBoat")}</span>
              <span className="text-sm text-slate-600">{s.valid_from} → {s.valid_to ?? "…"}</span>
              {!s.active && <Badge>{t("inactive")}</Badge>}
              <form action={deleteSchedule}>
                <input type="hidden" name="id" value={s.id} />
                <Button variant="secondary" type="submit">{t("delete")}</Button>
              </form>
            </div>
            <form action={generateTrips} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={s.id} />
              <Field label={t("from")}><Input type="date" name="from" defaultValue={today} required /></Field>
              <Field label={t("to")}><Input type="date" name="to" defaultValue={addDays(today, 90)} required /></Field>
              <Button type="submit">{t("createTrips")}</Button>
            </form>
            <p className="mt-2 text-xs text-slate-500">{t("createTripsHint")}</p>
          </Card>
        );
      })}

    </>
  );
}
