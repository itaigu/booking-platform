import { TimePicker } from "@/components/time-picker";
import { canBook, pageContext } from "@/lib/auth";
import { addDays, dayStart, fmtLongDate, isDay, todayLocal } from "@/lib/format";
import type { Availability } from "@/lib/types";
import { DayGrid, type Block, type Boat } from "@/components/day-grid";
import { AddToggle, Button, ButtonLink, Card, Field, Flash, Input, PageTitle, Select } from "@/components/ui";
import { createTrip } from "./actions";


export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const { supabase, staff, lang, t } = await pageContext();
  const date = isDay(sp.date as string) ? (sp.date as string) : todayLocal();
  const next = addDays(date, 1);
  const adding = sp.add === "1";

  const [{ data: tripData }, { data: blockData }, { data: products }, { data: boatData }] = await Promise.all([
    supabase
      .from("departure_availability")
      .select("*")
      .gte("starts_at", dayStart(date))
      .lt("starts_at", dayStart(next))
      .order("starts_at"),
    supabase
      .from("boat_blocks")
      .select("id, boat_id, starts_at, ends_at, reason")
      .lt("starts_at", dayStart(next))
      .gt("ends_at", dayStart(date)),
    supabase.from("products").select("id, name_en, name_es").eq("active", true).order("name_en"),
    supabase.from("boats").select("*").order("name"),
  ]);
  const trips = (tripData ?? []) as Availability[];
  const blocks = (blockData ?? []) as Block[];
  const allBoats = (boatData ?? []) as Boat[];

  // One column per active boat, plus any inactive boat that still has a trip today.
  const boats = allBoats.filter((b) => b.active || trips.some((tr) => tr.boat_id === b.id));

  const isToday = date === todayLocal();
  const error = sp.error === "noAccess" ? t("noAccess") : (sp.error as string | undefined);
  const q = (d: string) => `/calendar?date=${d}`;

  return (
    <>
      <PageTitle actions={canBook(staff.role) && <AddToggle href={q(date)} open={adding} label={t("addTrip")} />}>
        {t("calendar")}
      </PageTitle>
      <Flash error={error} ok={sp.ok as string | undefined} />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <ButtonLink variant="secondary" href={q(addDays(date, -1))} aria-label={t("previous")}>‹</ButtonLink>
        <ButtonLink variant={isToday ? "primary" : "secondary"} href={q(todayLocal())}>{t("today")}</ButtonLink>
        <ButtonLink variant="secondary" href={q(next)} aria-label={t("next")}>›</ButtonLink>
        <form action="/calendar" className="flex items-end gap-2">
          <Input type="date" name="date" defaultValue={date} aria-label={t("date")} />
          <Button variant="secondary" type="submit">{t("goTo")}</Button>
        </form>
        <h2 className="ml-auto text-lg font-semibold capitalize">{fmtLongDate(date, lang)}</h2>
      </div>

      {adding && canBook(staff.role) && (
        <Card title={t("addTrip")}>
          <form action={createTrip} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <Field label={t("tour")}>
              <Select name="product_id" required>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{lang === "es" ? p.name_es : p.name_en}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("boat")}>
              <Select name="boat_id" required>
                {allBoats.filter((b) => b.active).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("date")}>
              <Input type="date" name="date" defaultValue={date} required />
            </Field>
            <Field label={t("time")} group className="sm:col-span-3 sm:max-w-md">
              <TimePicker name="time" />
            </Field>
            <Button type="submit" className="sm:w-fit">{t("add")}</Button>
          </form>
        </Card>
      )}

      <DayGrid boats={boats} trips={trips} blocks={blocks} date={date} lang={lang} t={t} />
    </>
  );
}
