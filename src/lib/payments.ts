import { getStripe } from "./stripe";
import type { createClient } from "./supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

// What a booking still owes: its total minus payments, plus refunds (tips don't count).
export async function balanceDue(supabase: Db, bookingId: number, total: number) {
  const { data } = await supabase.from("payments").select("kind, amount").eq("booking_id", bookingId);
  const paid = (data ?? []).reduce(
    (sum, p) => sum + (p.kind === "payment" ? Number(p.amount) : p.kind === "refund" ? -Number(p.amount) : 0),
    0,
  );
  return Math.round((total - paid) * 100) / 100;
}

// Switch off open payment links in Stripe and mark them cancelled.
// Without linkId: every open link of the booking (when it is cancelled).
export async function closeOpenLinks(supabase: Db, bookingId: number, linkId?: number) {
  let q = supabase.from("payment_links").select("id, stripe_link_id").eq("booking_id", bookingId).eq("status", "open");
  if (linkId) q = q.eq("id", linkId);
  const { data } = await q;
  const stripe = getStripe();
  for (const l of data ?? []) {
    if (stripe) await stripe.paymentLinks.update(l.stripe_link_id, { active: false });
    const { error } = await supabase.from("payment_links").update({ status: "cancelled" }).eq("id", l.id);
    if (error) throw new Error(error.message);
  }
}
