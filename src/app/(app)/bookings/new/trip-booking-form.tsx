"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Stepper } from "@/components/stepper";
import { TimePicker } from "@/components/time-picker";
import { Button, Card, choiceCard, Field, FormSection, Input, MoneyInput, Select } from "@/components/ui";
import { fmtClock } from "@/lib/format";
import type { HotelOption } from "@/lib/types";
import { createTripBooking } from "../actions";
import { CustomerCard, DetailsCard } from "./customer-cards";

export type Template = {
  id: number;
  name: string;
  kind: "private" | "shared";
  duration_minutes: number;
  buffer_minutes: number;
  min_guests: number;
  max_guests: number | null;
  base_price: number | null;
  base_guests: number | null;
  extra_guest_price: number | null;
  extra_hour_price: number | null;
  guest_price: number | null;
  boat_id: number | null;
};

export type BoatOption = { id: number; name: string; max_guests: number };

type Props = {
  templates: Template[];
  boats: BoatOption[];
  hotels: HotelOption[];
  date: string;
  labels: Record<string, string>;
  lang: "es" | "en";
};

// New booking: the trip is created together with the booking, with its own
// details. A tour can be picked to fill in the form, but everything stays editable.
export function TripBookingForm({ templates, boats, hotels, date, labels: l, lang }: Props) {
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const template = templates.find((x) => String(x.id) === templateId);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    startTransition(async () => {
      const result = await createTripBooking(form);
      if (result?.error) setError(result.error);
    });
  }

  // Picking another tour starts the trip fields again from that tour.
  return (
    <form onSubmit={submit}>
      <CustomerCard labels={l} lang={lang} />

      <Card>
        <div className="flex flex-col gap-6">
          <TripFields
            key={templateId}
            template={template}
            boats={boats}
            date={date}
            l={l}
            lang={lang}
            picker={
              templates.length > 0 && (
                <div className="sm:col-span-2">
                  <Field label={l.fromTour} hint={l.fromTourHint}>
                    <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="sm:max-w-sm">
                      <option value="">{l.fromTourNone}</option>
                      {templates.map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )
            }
          />
        </div>
      </Card>

      <DetailsCard labels={l} hotels={hotels} />

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200 sm:mr-auto">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="min-h-11 px-6">
          {pending ? l.saving : l.createBooking}
        </Button>
      </div>
    </form>
  );
}

const toNum = (s: string) => (s.trim() === "" ? 0 : Number(s) || 0);
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function TripFields({
  template: tp,
  boats,
  date,
  l,
  lang,
  picker,
}: {
  picker: ReactNode;
  template?: Template;
  boats: BoatOption[];
  date: string;
  l: Record<string, string>;
  lang: "es" | "en";
}) {
  const sl = { less: l.less, more: l.more };
  const [kind, setKind] = useState<"private" | "shared">(tp?.kind ?? "private");
  const [boatId, setBoatId] = useState(String(boats.find((b) => b.id === tp?.boat_id)?.id ?? boats[0]?.id ?? ""));
  const [start, setStart] = useState(9 * 60);
  const [duration, setDuration] = useState(tp?.duration_minutes ?? 180);
  const [buffer, setBuffer] = useState(tp?.buffer_minutes ?? 30);
  // private charter
  const [baseGuests, setBaseGuests] = useState(Math.min(tp?.base_guests ?? 4, 4));
  const [basePrice, setBasePrice] = useState(tp?.base_price != null ? String(tp.base_price) : "");
  const [extraGuests, setExtraGuests] = useState(0);
  const [extraGuestPrice, setExtraGuestPrice] = useState(tp?.extra_guest_price != null ? String(tp.extra_guest_price) : "");
  const [extraHours, setExtraHours] = useState(0);
  const [extraHourPrice, setExtraHourPrice] = useState(tp?.extra_hour_price != null ? String(tp.extra_hour_price) : "");
  // shared tour
  const [guests, setGuests] = useState(2);
  const [guestPrice, setGuestPrice] = useState(tp?.guest_price != null ? String(tp.guest_price) : "");
  const [seats, setSeats] = useState(tp?.kind === "shared" && tp.max_guests ? tp.max_guests : 12);
  const [minGuests, setMinGuests] = useState(tp?.kind === "shared" ? tp.min_guests : 1);
  const [override, setOverride] = useState("");

  // Keep every number inside what the chosen boat holds.
  const boat = boats.find((b) => String(b.id) === boatId);
  const boatMax = boat?.max_guests ?? 1;
  const base = Math.min(baseGuests, 4, boatMax);
  const extra = Math.min(extraGuests, Math.max(boatMax - base, 0));
  const seatsNow = Math.min(seats, boatMax);
  const guestsNow = Math.min(guests, seatsNow);
  const minNow = Math.min(minGuests, seatsNow);
  const hours = kind === "private" ? extraHours : 0;

  const lines: [string, number, number][] =
    kind === "private"
      ? [
          [`${l.lineCharter} (${l.upTo} ${base} pax)`, 1, toNum(basePrice)],
          ...(extra > 0 ? [[l.extraPax, extra, toNum(extraGuestPrice)] as [string, number, number]] : []),
          ...(hours > 0 ? [[l.extraHours, hours, toNum(extraHourPrice)] as [string, number, number]] : []),
        ]
      : [[l.pricePerPerson, guestsNow, toNum(guestPrice)]];
  const total = lines.reduce((s, [, q, p]) => s + q * p, 0);
  const totalGuests = kind === "private" ? base + extra : guestsNow;

  const back = start + duration + hours * 60;
  const timeLabels = { morning: l.morning, afternoon: l.afternoon, evening: l.evening, minutes: l.minutes };

  return (
    <>
      <FormSection title={l.secTrip} desc={l.secTripDesc}>
        {picker}
        <div className="sm:col-span-2">
          <Field label={l.tripName}>
            <Input name="name" defaultValue={tp?.name} placeholder={l.tripNamePh} required autoComplete="off" />
          </Field>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-slate-700">{l.kind}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["private", "shared"] as const).map((k) => (
              <label key={k} className={choiceCard}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                <span className="font-semibold text-slate-900">{l[k]}</span>
                <span className="text-xs leading-snug text-slate-600">{k === "private" ? l.privateDesc : l.sharedTripDesc}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection title={l.secWhen} desc={l.secWhenDesc}>
        <Field label={l.date}>
          <Input type="date" name="date" defaultValue={date} required className="sm:max-w-[14rem]" />
        </Field>
        <Field label={l.boat}>
          <Select name="boat_id" value={boatId} onChange={(e) => setBoatId(e.target.value)} required>
            {boats.map((b) => (
              <option key={b.id} value={b.id}>{b.name} · {b.max_guests} pax</option>
            ))}
          </Select>
        </Field>
        <Field label={l.time} group className="sm:col-span-2">
          <TimePicker name="time" lang={lang} labels={timeLabels} onChange={setStart} />
        </Field>
        <Field label={l.duration} group>
          <Stepper name="duration_minutes" value={duration} onChange={setDuration} min={30} max={720} step={30} show="hours" label={l.duration} {...sl} />
        </Field>
        <Field label={l.bufferMin} hint={l.bufferHint} group>
          <Stepper name="buffer_minutes" value={buffer} onChange={setBuffer} min={0} max={180} step={15} show="minutes" label={l.bufferMin} {...sl} />
        </Field>
        <p className="text-sm text-slate-600 sm:col-span-2">
          {fmtClock(start, lang)} → <strong className="text-slate-900">{fmtClock(back % 1440, lang)}</strong>
          {buffer > 0 && <> · {l.boatFree} {fmtClock((back + buffer) % 1440, lang)}</>}
        </p>
      </FormSection>

      <FormSection title={l.secPax} desc={kind === "private" ? l.privateDesc : l.sharedTripDesc}>
        <fieldset disabled={kind !== "private"} hidden={kind !== "private"} className="min-w-0 sm:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={l.paxIncluded} hint={l.paxIncludedHint} group>
              <Stepper name="base_guests" value={base} onChange={setBaseGuests} min={1} max={Math.min(4, boatMax)} unit="pax" label={l.paxIncluded} {...sl} />
            </Field>
            <Field label={l.basePrice}>
              <MoneyInput name="base_price" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required />
            </Field>
            <Field label={l.extraPax} group>
              <Stepper name="extra_guests" value={extra} onChange={setExtraGuests} min={0} max={Math.max(boatMax - base, 0)} unit="pax" label={l.extraPax} {...sl} />
            </Field>
            <Field label={l.extraGuestPrice}>
              <MoneyInput name="extra_guest_price" value={extraGuestPrice} onChange={(e) => setExtraGuestPrice(e.target.value)} required={extra > 0} />
            </Field>
            <Field label={l.extraHours} group>
              <Stepper name="extra_hours" value={extraHours} onChange={setExtraHours} min={0} max={12} unit="h" label={l.extraHours} {...sl} />
            </Field>
            <Field label={l.extraHourPrice}>
              <MoneyInput name="extra_hour_price" value={extraHourPrice} onChange={(e) => setExtraHourPrice(e.target.value)} required={extraHours > 0} />
            </Field>
          </div>
        </fieldset>
        <fieldset disabled={kind !== "shared"} hidden={kind !== "shared"} className="min-w-0 sm:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={l.paxThisBooking} group>
              <Stepper name="guests" value={guestsNow} onChange={setGuests} min={1} max={seatsNow} unit="pax" label={l.paxThisBooking} {...sl} />
            </Field>
            <Field label={l.pricePerPerson}>
              <MoneyInput name="guest_price" value={guestPrice} onChange={(e) => setGuestPrice(e.target.value)} required />
            </Field>
            <Field label={l.seatsThisTrip} group>
              <Stepper name="max_guests" value={seatsNow} onChange={setSeats} min={1} max={boatMax} unit="pax" label={l.seatsThisTrip} {...sl} />
            </Field>
            <Field label={l.minGuests} group>
              <Stepper name="min_guests" value={minNow} onChange={setMinGuests} min={1} max={seatsNow} unit="pax" label={l.minGuests} {...sl} />
            </Field>
          </div>
        </fieldset>

        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200 sm:col-span-2">
          <table className="w-full text-sm">
            <caption className="sr-only">{l.priceSummary}</caption>
            <tbody>
              {lines.map(([label, q, p]) => (
                <tr key={label}>
                  <td className="py-1 text-slate-700">{label}</td>
                  <td className="py-1 text-right text-slate-500 tabular-nums">
                    {q > 1 || kind === "shared" ? `${q} × ${money(p)}` : ""}
                  </td>
                  <td className="w-28 py-1 text-right font-medium text-slate-900 tabular-nums">{money(q * p)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300">
                <th scope="row" className="pt-2 text-left font-semibold text-slate-900">
                  {l.total} <span className="font-normal text-slate-500">· {totalGuests} pax</span>
                </th>
                <td />
                <td className={`pt-2 text-right text-base font-semibold tabular-nums ${override ? "text-slate-400 line-through" : "text-slate-900"}`}>
                  {money(total)}
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-4">
            <Field label={l.priceOverride} hint={l.priceOverrideHint}>
              <MoneyInput name="total_override" value={override} onChange={(e) => setOverride(e.target.value)} />
            </Field>
          </div>
        </div>
      </FormSection>
    </>
  );
}
