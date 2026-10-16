import type Stripe from "stripe";
import { fromCents, getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

// Stripe calls this when a customer pays a payment link.
// Set it up in Stripe under Developers → Webhooks, with the events
// checkout.session.completed and checkout.session.async_payment_succeeded,
// and put its signing secret in STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabase = createAdminClient();
  if (!stripe || !secret || !supabase) return new Response("Stripe is not set up", { status: 500 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const link = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;
    const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    // Bank transfers and OXXO finish later and come back as async_payment_succeeded.
    if (link && paymentId && session.payment_status === "paid" && session.amount_total) {
      const { error } = await supabase.rpc("record_stripe_payment", {
        p_stripe_link_id: link,
        p_stripe_payment_id: paymentId,
        p_amount: fromCents(session.amount_total),
      });
      // Stripe tries again later if this fails.
      if (error) return new Response(error.message, { status: 500 });
    }
  }
  return new Response("ok");
}
