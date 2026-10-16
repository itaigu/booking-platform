import { updateTrip } from "@/app/(app)/departures/[id]/actions";
import { localDayOf, localMinutes } from "@/lib/format";
import type { Lang, T } from "@/lib/i18n";
import type { Availability } from "@/lib/types";
import { Stepper } from "./stepper";
import { TimePicker } from "./time-picker";
import { Button, Field, FormSection, Input, Select } from "./ui";

const pad = (n: number) => String(n).padStart(2, "0");
const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

// Change a trip's date, time, boat and duration. Every booking on it moves too.
// `back` is the page to return to (the booking or the trip).
export function EditTripForm({
  trip,
  boats,
  back,
  lang,
  t,
}: {
  trip: Availability;
  boats: { id: number; name: string; max_guests: number; active: boolean }[];
  back: string;
  lang: Lang;
  t: T;
}) {
  const start = localMinutes(trip.starts_at);
  // Extra hours booked on a one-off private trip stay on top of the duration.
  const duration = minutesBetween(trip.starts_at, trip.ends_at) - trip.extra_hours * 60;
  const buffer = minutesBetween(trip.ends_at, trip.boat_free_at);
  const sl = { less: t("less"), more: t("more") };
  const choices = boats.filter((b) => b.active || b.id === trip.boat_id);

  return (
    <form action={updateTrip} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={trip.id} />
      <input type="hidden" name="back" value={back} />
      <FormSection title={t("secWhen")} desc={t("editTripDesc")}>
        {trip.one_off && (
          <div className="sm:col-span-2">
            <Field label={t("tripName")}>
              <Input name="name" defaultValue={lang === "es" ? trip.product_name_es : trip.product_name_en} required autoComplete="off" />
            </Field>
          </div>
        )}
        <Field label={t("date")}>
          <Input type="date" name="date" defaultValue={localDayOf(trip.starts_at)} required className="sm:max-w-[14rem]" />
        </Field>
        <Field label={t("boat")}>
          <Select name="boat_id" defaultValue={trip.boat_id} required>
            {choices.map((b) => (
              <option key={b.id} value={b.id}>{b.name} · {b.max_guests} pax</option>
            ))}
          </Select>
        </Field>
        <Field label={t("time")} group className="sm:col-span-2">
          <TimePicker
            name="time"
            defaultValue={`${pad(Math.floor(start / 60))}:${pad(start % 60)}`}
            lang={lang}
            labels={{ morning: t("morning"), afternoon: t("afternoon"), evening: t("evening"), minutes: t("minutes") }}
          />
        </Field>
        <Field label={t("duration")} hint={trip.extra_hours > 0 ? t("plusExtraHours").replace("{n}", String(trip.extra_hours)) : undefined} group>
          <Stepper name="duration_minutes" defaultValue={duration} min={30} max={720} step={30} show="hours" label={t("duration")} {...sl} />
        </Field>
        <Field label={t("bufferMin")} hint={t("bufferHint")} group>
          <Stepper name="buffer_minutes" defaultValue={buffer} min={0} max={180} step={15} show="minutes" label={t("bufferMin")} {...sl} />
        </Field>
        {trip.bookings_count > 1 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 sm:col-span-2">
            {t("editTripMovesAll").replace("{n}", String(trip.bookings_count))}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit">{t("saveChanges")}</Button>
        </div>
      </FormSection>
    </form>
  );
}
