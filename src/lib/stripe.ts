import Stripe from "stripe";

// Stripe, or null when STRIPE_SECRET_KEY is not set yet in Vercel.
// The secret key must never be sent to the browser.
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

// Dollars to cents and back (Stripe counts in cents).
export const toCents = (usd: number) => Math.round(usd * 100);
export const fromCents = (cents: number) => cents / 100;
