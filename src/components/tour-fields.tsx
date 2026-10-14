import type { T } from "@/lib/i18n";
import { Field, Grid, Input, Select } from "./ui";

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
  season_start: string | null;
  season_end: string | null;
  active: boolean;
};

// Form fields for creating or editing a tour.
export function TourFields({ p, t }: { p?: Product; t: T }) {
  return (
    <Grid>
      <Field label={t("nameEn")}><Input name="name_en" defaultValue={p?.name_en} required /></Field>
      <Field label={t("nameEs")}><Input name="name_es" defaultValue={p?.name_es} required /></Field>
      <Field label={t("kind")}>
        <Select name="kind" defaultValue={p?.kind ?? "shared"}>
          <option value="shared">{t("shared")}</option>
          <option value="private">{t("private")}</option>
        </Select>
      </Field>
      <Field label={t("durationMin")}><Input name="duration_minutes" type="number" min={1} defaultValue={p?.duration_minutes ?? 180} required /></Field>
      <Field label={t("bufferMin")}><Input name="buffer_minutes" type="number" min={0} defaultValue={p?.buffer_minutes ?? 30} /></Field>
      <Field label={`${t("maxGuestsShared")} (${t("shared")})`}><Input name="max_guests" type="number" min={1} defaultValue={p?.max_guests ?? ""} /></Field>
      <Field label={`${t("minGuests")} (${t("shared")})`}><Input name="min_guests" type="number" min={1} defaultValue={p?.min_guests ?? 1} /></Field>
      <Field label={`${t("basePrice")} (${t("private")})`}><Input name="base_price" type="number" step="0.01" min={0} defaultValue={p?.base_price ?? ""} /></Field>
      <Field label={`${t("baseGuests")} (${t("private")})`}><Input name="base_guests" type="number" min={1} defaultValue={p?.base_guests ?? 4} /></Field>
      <Field label={`${t("extraGuestPrice")} (${t("private")})`}><Input name="extra_guest_price" type="number" step="0.01" min={0} defaultValue={p?.extra_guest_price ?? ""} /></Field>
      <Field label={t("seasonStart")} hint={t("seasonHint")}><Input name="season_start" placeholder="12-15" pattern="\d{2}-\d{2}" defaultValue={p?.season_start ?? ""} /></Field>
      <Field label={t("seasonEnd")} hint={t("seasonHint")}><Input name="season_end" placeholder="04-15" pattern="\d{2}-\d{2}" defaultValue={p?.season_end ?? ""} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> {t("active")}
      </label>
    </Grid>
  );
}
