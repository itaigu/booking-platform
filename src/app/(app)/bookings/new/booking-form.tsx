"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { createBooking, getQuote } from "../actions";
import { CustomerCard, DetailsCard } from "./customer-cards";

type Props = {
  departureId: number;
  kind: "shared" | "private";
  seatsLeft: number;
  baseGuests: number | null;
  tickets: { id: number; name: string }[];
  labels: Record<string, string>;
  lang: "es" | "en";
};

export function BookingForm({ departureId, kind, seatsLeft, baseGuests, tickets, labels: l, lang }: Props) {
  const [qty, setQty] = useState<Record<number, number>>({});
  const [guests, setGuests] = useState(kind === "private" ? Math.min(baseGuests ?? 2, seatsLeft) : 0);
  const [quote, setQuote] = useState<{ key?: string; total?: number; error?: string }>({});
  const [, startTransition] = useTransition();

  const ticketList = tickets.map((tt) => ({ ticket_type_id: tt.id, quantity: qty[tt.id] ?? 0 }));
  const shared = kind === "shared";
  const totalGuests = shared ? ticketList.reduce((s, x) => s + x.quantity, 0) : guests;
  const ticketsJson = JSON.stringify(ticketList.filter((x) => x.quantity > 0));

  // Ask the database for the price whenever the tickets or guests change.
  const quoteKey = shared ? ticketsJson : String(guests);
  useEffect(() => {
    if (totalGuests < 1) return;
    startTransition(async () => {
      const result = await getQuote(departureId, shared ? ticketsJson : null, shared ? null : guests);
      setQuote({ key: quoteKey, ...result });
    });
  }, [departureId, shared, ticketsJson, guests, totalGuests, quoteKey]);
  const current = totalGuests > 0 && quote.key === quoteKey ? quote : {};

  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <form action={createBooking}>
      <input type="hidden" name="departure_id" value={departureId} />
      <input type="hidden" name="tickets" value={shared ? ticketsJson : ""} />

      <Card title={shared ? l.tickets : l.guests}>
        {shared ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tickets.map((tt) => (
              <Field key={tt.id} label={tt.name}>
                <Input
                  type="number"
                  min={0}
                  max={seatsLeft}
                  value={qty[tt.id] ?? 0}
                  onChange={(e) => setQty({ ...qty, [tt.id]: Math.max(0, Number(e.target.value)) })}
                />
              </Field>
            ))}
          </div>
        ) : (
          <Field label={l.guests} hint={baseGuests ? `${l.baseGuests}: ${baseGuests}` : undefined}>
            <Input
              type="number"
              name="guests"
              min={1}
              max={seatsLeft}
              value={guests}
              onChange={(e) => setGuests(Math.max(0, Number(e.target.value)))}
              className="w-32"
            />
          </Field>
        )}
        <p className="mt-3 text-sm">
          {l.guests}: <strong>{totalGuests}</strong> / {seatsLeft} ·{" "}
          {l.estimate}:{" "}
          {current.error ? (
            <span className="text-red-700">{current.error}</span>
          ) : current.total !== undefined ? (
            <strong>{money(current.total)}</strong>
          ) : (
            "–"
          )}
        </p>
        <div className="mt-3 max-w-xs">
          <Field label={l.priceOverride} hint={l.priceOverrideHint}>
            <Input type="number" name="total_override" min={0} step="0.01" />
          </Field>
        </div>
      </Card>

      <CustomerCard labels={l} lang={lang} />
      <DetailsCard labels={l} />

      <Button type="submit" disabled={totalGuests < 1 || totalGuests > seatsLeft}>
        {l.createBooking}
      </Button>
    </form>
  );
}
