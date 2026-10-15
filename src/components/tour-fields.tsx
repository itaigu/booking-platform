import type { T } from "@/lib/i18n";
import { Field, Input } from "./ui";
import { Stepper } from "./stepper";

export type Product = {
  id: number;
  name_en: string;
  name_es: string;
  kind: "shared" | "private";
  duration_minutes: number;
  buffer_minutes: number;
  min_guests: number;
  max_guests: number | null;
  base_price: number | null;
  base_guests: number | null;
  extra_guest_price: number | null;
  max_extra_hours: number;
  extra_hour_price: number | null;
  season_start: string | null;
  season_end: string | null;
  active: boolean;
};

const kindBtn =
  "cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 has-checked:border-sky-700 has-checked:bg-sky-700 has-checked:text-white";

// Form fields for creating or editing a tour. The private-charter and
// shared-tour sections show or hide depending on which type is picked.
export function TourFields({ p, t }: { p?: Product; t: T }) {
  const kind = p?.kind ?? "private";
  const baseGuests = p?.base_guests ?? 4;
  const extraGuests = p?.kind === "private" && p.max_guests ? Math.max(p.max_guests - baseGuests, 0) : 0;
  return (
    <div className="group/tour flex flex-col gap-4">
      <Field label={t("tourName")}>
        <Input name="name" defaultValue={p?.name_es || p?.name_en} required />
      </Field>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t("kind")}</span>
        <div className="flex flex-wrap gap-2">
          <label className={kindBtn}>
            <input type="radio" name="kind" value="private" defaultChecked={kind === "private"} className="sr-only" />
            {t("private")}
          </label>
          <label className={kindBtn}>
            <input type="radio" name="kind" value="shared" defaultChecked={kind === "shared"} className="sr-only" />
            {t("shared")}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("duration")} group>
          <Stepper name="duration_minutes" defaultValue={p?.duration_minutes ?? 180} min={30} max={720} step={30} show="hours" />
        </Field>
        <Field label={t("bufferMin")} group>
          <Stepper name="buffer_minutes" defaultValue={p?.buffer_minutes ?? 30} min={0} max={180} step={15} show="minutes" />
        </Field>
        <Field label={t("maxExtraHours")} hint={t("maxExtraHoursHint")} group>
          <Stepper name="max_extra_hours" defaultValue={p?.max_extra_hours ?? 0} min={0} max={8} />
        </Field>
        <Field label={t("extraHourPrice")}>
          <Input name="extra_hour_price" type="number" step="0.01" min={0} defaultValue={p?.extra_hour_price ?? ""} />
        </Field>
      </div>

      {/* Private charter */}
      <div className="hidden grid-cols-1 gap-4 rounded-md bg-slate-50 p-3 group-has-[input[value=private]:checked]/tour:grid sm:grid-cols-2">
        <Field label={t("basePrice")}>
          <Input name="base_price" type="number" step="0.01" min={0} defaultValue={p?.base_price ?? ""} />
        </Field>
        <Field label={t("baseGuests")} group>
          <Stepper name="base_guests" defaultValue={baseGuests} min={1} max={4} />
        </Field>
        <Field label={t("extraGuests")} hint={t("extraGuestsHint")} group>
          <Stepper name="extra_guests" defaultValue={extraGuests} min={0} max={40} />
        </Field>
        <Field label={t("extraGuestPrice")}>
          <Input name="extra_guest_price" type="number" step="0.01" min={0} defaultValue={p?.extra_guest_price ?? ""} />
        </Field>
      </div>

      {/* Shared tour */}
      <div className="hidden grid-cols-1 gap-4 rounded-md bg-slate-50 p-3 group-has-[input[value=shared]:checked]/tour:grid sm:grid-cols-2">
        <Field label={t("maxGuestsShared")} group>
          <Stepper name="shared_max_guests" defaultValue={p?.kind === "shared" ? (p.max_guests ?? 20) : 20} min={1} max={150} />
        </Field>
        <Field label={t("minGuests")} group>
          <Stepper name="min_guests" defaultValue={p?.min_guests ?? 1} min={1} max={150} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("seasonStart")} hint={t("seasonHint")}>
          <Input name="season_start" placeholder="12-15" pattern="\d{2}-\d{2}" defaultValue={p?.season_start ?? ""} />
        </Field>
        <Field label={t("seasonEnd")} hint={t("seasonHint")}>
          <Input name="season_end" placeholder="04-15" pattern="\d{2}-\d{2}" defaultValue={p?.season_end ?? ""} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> {t("active")}
      </label>
    </div>
  );
}
