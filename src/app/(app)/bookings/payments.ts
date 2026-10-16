"use server";

import { actionContext, num, str } from "@/lib/actions";
import { fmtDateTime } from "@/lib/format";
import { balanceDue, closeOpenLinks } from "@/lib/payments";
import { getStripe, toCents } from "@/lib/stripe";

// A Stripe payment link for part (a deposit) or all of what the booking still owes.
export async function createPaymentLink(form: FormData) {
  const id = Number(str(form, "id"));
  const back = `/bookings/${id}`;
  const { supabase, staff, lang, fail, go } = await actionContext(back, ["admin", "office"]);
  const stripe = getStripe();
  if (!stripe) fail("Stripe is not set up yet");

  const { data: b } = await supabase
    .from("bookings")
    .select("booking_number, total_price, status, departures(starts_at, products(name_en, name_es))")
    .eq("id", id)
    .maybeSingle();
  if (!b) return fail("Booking not found");
  if (b.status !== "confirmed") fail("Only confirmed bookings");
  const amount = num(form, "amount");
  if (!amount || amount <= 0) fail("Enter the amount");
  const due = await balanceDue(supabase, id, Number(b.total_price));
  if (amount! > due) fail(`The amount is more than the balance due (${due})`);

  const dep = b.departures as unknown as { starts_at: string; products: { name_en: string; name_es: string } };
  const tripName = lang === "es" ? dep.products.name_es : dep.products.name_en;
  const meta = { booking_id: String(id), booking_number: b.booking_number };

  let link: { id: string; url: string };
  try {
    link = await stripe!.paymentLinks.create({
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: toCents(amount!),
            product_data: {
              name: `Cabo Sailing · ${tripName}`,
              description: `${fmtDateTime(dep.starts_at, lang)} · ${b.booking_number}`,
            },
          },
        },
      ],
      // One payment per link, then Stripe switches it off.
      restrictions: { completed_sessions: { limit: 1 } },
      metadata: meta,
      payment_intent_data: { metadata: meta, description: b.booking_number },
      after_completion: {
        type: "hosted_confirmation",
        hosted_confirmation: { custom_message: "Thank you! / ¡Gracias! Cabo Sailing" },
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const { error } = await supabase.from("payment_links").insert({
    booking_id: id,
    amount,
    stripe_link_id: link.id,
    url: link.url,
    created_by: staff.id,
  });
  if (error) {
    await stripe!.paymentLinks.update(link.id, { active: false }).catch(() => {});
    fail(error.message);
  }
  go(back, { ok: lang === "es" ? "Enlace de pago creado" : "Payment link created" });
}

export async function cancelPaymentLink(form: FormData) {
  const id = Number(str(form, "id"));
  const back = `/bookings/${id}`;
  const { supabase, lang, fail, go } = await actionContext(back, ["admin", "office"]);
  try {
    await closeOpenLinks(supabase, id, Number(str(form, "link_id")));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  go(back, { ok: lang === "es" ? "Enlace cancelado" : "Link cancelled" });
}

// A payment taken in person: cash, card at the dock, or another way.
export async function recordPayment(form: FormData) {
  const id = Number(str(form, "id"));
  const back = `/bookings/${id}`;
  const { supabase, staff, lang, fail, go } = await actionContext(back, ["admin", "office", "dock"]);
  const amount = num(form, "amount");
  if (!amount || amount <= 0) fail("Enter the amount");
  const { error } = await supabase.from("payments").insert({
    booking_id: id,
    kind: str(form, "kind"),
    method: str(form, "method"),
    amount,
    note: str(form, "note") || null,
    recorded_by: staff.id,
  });
  if (error) fail(error.message);
  go(back, { ok: lang === "es" ? "Pago registrado" : "Payment recorded" });
}

// Admin only: delete a payment taken in person that was recorded by mistake.
export async function deletePayment(form: FormData) {
  const id = Number(str(form, "id"));
  const back = `/bookings/${id}`;
  const { supabase, lang, fail, go } = await actionContext(back, ["admin"]);
  const { data, error } = await supabase
    .from("payments")
    .delete()
    .eq("id", Number(str(form, "payment_id")))
    .eq("booking_id", id)
    .select("id");
  if (error) fail(error.message);
  if (!data?.length) fail("row-level security");
  go(back, { ok: lang === "es" ? "Pago eliminado" : "Payment deleted" });
}
