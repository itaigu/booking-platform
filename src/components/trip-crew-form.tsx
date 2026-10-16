import { setTripCrew } from "@/app/(app)/departures/[id]/actions";
import type { T } from "@/lib/i18n";
import { Button, Card, Field, Input } from "./ui";

// The captain and crew of a trip, written as names. Shown on the trip page
// and on its bookings' pages; it is the same field for the whole trip.
export function TripCrewForm({ departureId, crew, back, t }: { departureId: number; crew: string | null; back: string; t: T }) {
  return (
    <Card title={t("crewOnBoard")}>
      <form action={setTripCrew} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={departureId} />
        <input type="hidden" name="back" value={back} />
        <Field label={t("crewNames")} hint={t("crewHint")} className="min-w-0 flex-1 sm:max-w-xl">
          <Input name="crew" defaultValue={crew ?? ""} placeholder={t("crewPlaceholder")} autoComplete="off" />
        </Field>
        <Button type="submit" variant="secondary" className="mb-5">{t("save")}</Button>
      </form>
    </Card>
  );
}
