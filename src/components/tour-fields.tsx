import type { T } from "@/lib/i18n";
import { Field, FormSection as Section, Input, MoneyInput } from "./ui";
import { Stepper } from "./stepper";
import { TourKindSwitch } from "./tour-kind-switch";

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
  active: boolean;
};

// Form fields for creating or editing a tour: only the basics.
// `boatMax` is the biggest linked boat, used when the tour has no guest limit yet.
// `guestPrice` is a shared tour's price per person.
export function TourFields({ p, t, boatMax, guestPrice }: { p?: Product; t: T; boatMax?: number; guestPrice?: number | null }) {
  const kind = p?.kind ?? "private";
  const baseGuests = p?.base_guests ?? 4;
  const cap_ = p?.max_guests ?? boatMax;
  const extraGuests = p?.kind === "private" && cap_ ? Math.max(cap_ - baseGuests, 0) : 0;
  const sl = { less: t("less"), more: t("more") };


  return (
    <div className="flex flex-col gap-6">
      <Section title={t("secBasics")}>
        <div className="sm:col-span-2">
          <Field label={t("tourName")}>
            <Input name="name" defaultValue={p?.name_es || p?.name_en} placeholder={t("tourNamePh")} required />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-5 w-5 accent-sky-700" />
          <span>
            <span className="font-medium text-slate-900">{t("active")}</span>{" "}
            <span className="text-slate-500">— {t("activeHint")}</span>
          </span>
        </label>
      </Section>

      <Section title={t("secPricing")} desc={t("secPricingDesc")}>
        <TourKindSwitch
          defaultKind={kind}
          legend={t("kind")}
          options={[
            { value: "private", title: t("private"), desc: t("privateDesc") },
            { value: "shared", title: t("shared"), desc: t("sharedDesc") },
          ]}
          sections={{
            private: (
              <>
                <Field label={t("basePrice")}>
                  <MoneyInput name="base_price" defaultValue={p?.base_price ?? ""} required />
                </Field>
                <Field label={t("baseGuests")} group>
                  <Stepper name="base_guests" defaultValue={baseGuests} min={1} max={Math.max(4, baseGuests)} unit="pax" label={t("baseGuests")} {...sl} />
                </Field>
                <Field label={t("extraGuests")} hint={t("extraGuestsHint")} group>
                  <Stepper name="extra_guests" defaultValue={extraGuests} min={0} max={60} unit="pax" label={t("extraGuests")} {...sl} />
                </Field>
                <Field label={t("extraGuestPrice")}>
                  <MoneyInput name="extra_guest_price" defaultValue={p?.extra_guest_price ?? ""} />
                </Field>
                <Field label={t("maxExtraHours")} hint={t("maxExtraHoursHint")} group>
                  <Stepper name="max_extra_hours" defaultValue={p?.max_extra_hours ?? 0} min={0} max={8} unit="h" label={t("maxExtraHours")} {...sl} />
                </Field>
                <Field label={t("extraHourPrice")}>
                  <MoneyInput name="extra_hour_price" defaultValue={p?.extra_hour_price ?? ""} />
                </Field>
              </>
            ),
            shared: (
              <>
                <Field label={t("pricePerPerson")}>
                  <MoneyInput name="guest_price" defaultValue={guestPrice ?? ""} required />
                </Field>
                <Field label={t("maxGuestsShared")} group>
                  <Stepper
                    name="shared_max_guests"
                    defaultValue={p?.kind === "shared" ? (cap_ ?? 20) : 20}
                    min={1}
                    max={200}
                    unit="pax"
                    label={t("maxGuestsShared")}
                    {...sl}
                  />
                </Field>
                <Field label={t("minGuests")} group>
                  <Stepper name="min_guests" defaultValue={p?.min_guests ?? 1} min={1} max={200} unit="pax" label={t("minGuests")} {...sl} />
                </Field>
              </>
            ),
          }}
        />
      </Section>

      <Section title={t("secTiming")} desc={t("secTimingDesc")}>
        <Field label={t("duration")} group>
          <Stepper name="duration_minutes" defaultValue={p?.duration_minutes ?? 180} min={30} max={720} step={30} show="hours" label={t("duration")} {...sl} />
        </Field>
        <Field label={t("bufferMin")} hint={t("bufferHint")} group>
          <Stepper name="buffer_minutes" defaultValue={p?.buffer_minutes ?? 30} min={0} max={180} step={15} show="minutes" label={t("bufferMin")} {...sl} />
        </Field>
      </Section>

    </div>
  );
}
