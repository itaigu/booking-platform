import type { Lang, T } from "@/lib/i18n";
import { cap } from "@/lib/format";
import { choiceCard, Field, FormSection as Section, Input, MoneyInput, Select } from "./ui";
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
  season_start: string | null;
  season_end: string | null;
  active: boolean;
};

// Form fields for creating or editing a tour, in sections.
// `boatMax` is the biggest linked boat, used when the tour has no guest limit yet.
export function TourFields({ p, t, lang, boatMax }: { p?: Product; t: T; lang: Lang; boatMax?: number }) {
  const kind = p?.kind ?? "private";
  const baseGuests = p?.base_guests ?? 4;
  const cap_ = p?.max_guests ?? boatMax;
  const extraGuests = p?.kind === "private" && cap_ ? Math.max(cap_ - baseGuests, 0) : 0;
  const sl = { less: t("less"), more: t("more") };

  const monthFmt = new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { month: "long", timeZone: "UTC" });
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, "0"),
    label: cap(monthFmt.format(Date.UTC(2000, i, 1))),
  }));
  const monthDays = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
  const [sm, sd] = (p?.season_start ?? "12-15").split("-");
  const [em, ed] = (p?.season_end ?? "04-15").split("-");
  const seasonPicker = (key: "season_start" | "season_end", label: string, m: string, d: string) => (
    <Field label={label} group>
      <div className="flex gap-2">
        <Select name={`${key}_m`} aria-label={`${label}: ${t("month")}`} defaultValue={m} className="min-w-0 flex-1">
          {months.map((mo) => (
            <option key={mo.value} value={mo.value}>{mo.label}</option>
          ))}
        </Select>
        <Select name={`${key}_d`} aria-label={`${label}: ${t("day")}`} defaultValue={d} className="w-20">
          {monthDays.map((dd) => (
            <option key={dd} value={dd}>{Number(dd)}</option>
          ))}
        </Select>
      </div>
    </Field>
  );

  return (
    <div className="group/tour flex flex-col gap-6">
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
                <p className="text-xs text-slate-500 sm:col-span-2">{t("sharedPricesLater")}</p>
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

      <Section title={t("secSeason")} desc={t("secSeasonDesc")}>
        <fieldset className="sm:col-span-2">
          <legend className="sr-only">{t("secSeason")}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={choiceCard}>
              <input type="radio" name="season" value="all" defaultChecked={!p?.season_start} className="sr-only" />
              <span className="font-semibold text-slate-900">{t("allYear")}</span>
            </label>
            <label className={choiceCard}>
              <input type="radio" name="season" value="seasonal" defaultChecked={!!p?.season_start} className="sr-only" />
              <span className="font-semibold text-slate-900">{t("seasonalOnly")}</span>
            </label>
          </div>
        </fieldset>
        <div className="hidden gap-4 group-has-[input[name=season][value=seasonal]:checked]/tour:grid sm:col-span-2 sm:grid-cols-2">
          {seasonPicker("season_start", t("seasonStart"), sm, sd)}
          {seasonPicker("season_end", t("seasonEnd"), em, ed)}
          <p className="text-xs text-slate-500 sm:col-span-2">{t("seasonHint")}</p>
        </div>
      </Section>
    </div>
  );
}
