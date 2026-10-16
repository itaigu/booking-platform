"use client";

import { useState } from "react";
import { Card, Field, Grid, Input, Select, Textarea } from "@/components/ui";

const channels = ["phone", "whatsapp", "walk_in", "ota", "other"] as const;

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
export function DetailsCard({ labels: l }: Pick<Props, "labels">) {
  const [channel, setChannel] = useState<string>("phone");
  return (
    <Card title={l.details}>
      <Grid>
        <Field label={l.channel}>
          <Select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {channels.map((c) => (
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
