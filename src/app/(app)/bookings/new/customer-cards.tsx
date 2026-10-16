"use client";

import { useState } from "react";
import { Card, Field, Grid, Input, Select, Textarea } from "@/components/ui";
import type { HotelOption } from "@/lib/types";

const channels = ["phone", "whatsapp", "walk_in", "hotel", "ota", "other"] as const;

type Props = { labels: Record<string, string>; lang: "es" | "en" };

// The customer, the same on both booking forms.
export function CustomerCard({ labels: l, lang }: Props) {
  return (
    <Card title={l.customer}>
      <Grid>
        <Field label={l.name}>
          <Input name="full_name" required autoComplete="off" />
        </Field>
        <Field label={l.phone}>
          <Input name="phone" type="tel" autoComplete="off" />
        </Field>
        <Field label={l.email}>
          <Input name="email" type="email" autoComplete="off" />
        </Field>
        <Field label={l.language}>
          <Select name="language" defaultValue={lang === "es" ? "es" : "en"}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </Select>
        </Field>
        <Field label={l.emergencyContact}>
          <Input name="emergency_contact_name" autoComplete="off" />
        </Field>
        <Field label={l.emergencyPhone}>
          <Input name="emergency_contact_phone" type="tel" autoComplete="off" />
        </Field>
      </Grid>
    </Card>
  );
}

// Channel, occasion and notes, the same on both booking forms.
// A hotel booking also needs the hotel, its code and the commission %.
export function DetailsCard({ labels: l, hotels }: Pick<Props, "labels"> & { hotels: HotelOption[] }) {
  const [channel, setChannel] = useState<string>("phone");
  const [hotelId, setHotelId] = useState("");
  const [pct, setPct] = useState("");
  const pickHotel = (id: string) => {
    setHotelId(id);
    const h = hotels.find((x) => String(x.id) === id);
    setPct(h ? String(Number(h.default_commission_pct)) : "");
  };
  return (
    <Card title={l.details}>
      <Grid>
        <Field label={l.channel}>
          <Select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {channels
              .filter((c) => c !== "hotel" || hotels.length > 0)
              .map((c) => (
                <option key={c} value={c}>{l[`channel_${c}`]}</option>
              ))}
          </Select>
        </Field>
        {channel === "ota" ? (
          <>
            <Field label={l.otaName}>
              <Input name="ota_name" />
            </Field>
            <Field label={l.otaReference}>
              <Input name="ota_reference" />
            </Field>
          </>
        ) : channel === "hotel" ? (
          <>
            <Field label={l.hotel}>
              <Select name="hotel_id" value={hotelId} onChange={(e) => pickHotel(e.target.value)} required>
                <option value="">{l.chooseHotel}</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={l.hotelCode} hint={l.hotelCodeHint}>
              <Input name="hotel_code" required autoComplete="off" />
            </Field>
            <Field label={l.commissionPct} hint={l.commissionPctHint}>
              <Input
                name="commission_pct"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                required
                className="sm:max-w-[10rem]"
              />
            </Field>
          </>
        ) : (
          <div />
        )}
        <Field label={l.occasion}>
          <Input name="occasion" placeholder={l.occasionHint} />
        </Field>
        <Field label={l.specialRequests}>
          <Textarea name="special_requests" />
        </Field>
        <Field label={l.internalNotes}>
          <Textarea name="internal_notes" />
        </Field>
      </Grid>
    </Card>
  );
}
