# Cabo Sailing booking platform: progress log

## Important

Platforms we use:

| Platform | What it's for | Link |
| --- | --- | --- |
| Supabase | Database and staff logins | [supabase.com/dashboard](https://supabase.com/dashboard) (project "cabo sailing Saas booking software") |
| Vercel | Hosts the staff dashboard | [vercel.com/dashboard](https://vercel.com/dashboard) |
| GitHub | Stores all the code | [github.com/itaigu/booking-platform](https://github.com/itaigu/booking-platform) |
| Stripe | Payments (added in step 4) | [dashboard.stripe.com](https://dashboard.stripe.com) |
| Rezdy | Current system, keeps running until step 4 is done | [app.rezdy.com](https://app.rezdy.com) |

Never write passwords or secret keys in this file.

## The plan

1. **Set up the basics:** accounts on Supabase, Vercel and GitHub, and the database design
2. **Core staff dashboard:** logins and roles, tours, boats, schedules, prices, availability calendar, bookings by phone, WhatsApp and walk-in, no overbooking
3. **Hotel bookings and commissions:** hotels, hotel prices, unique hotel codes, monthly commission report
4. **Everything else, then switch off Rezdy:** Stripe payments and refunds, daily manifest and check-in, notifications, reports, OTA connections

The plan may change after talking with the team about what they really need.

## Status

| Step | Status |
| --- | --- |
| 1. Set up the basics | Done |
| 2. Core staff dashboard | In progress |
| 3. Hotel bookings and commissions | Not started |
| 4. Everything else, switch off Rezdy | Not started |

## Log

### 2026-10-14
- Agreed the 4-step plan. Website online booking is out of scope for now.
- Designed the database and tested its rules: no overbooking, no double-booked boats, one hotel code per booking, commission frozen at sale time, cancelled bookings cancel their commission. See [docs/database.md](docs/database.md).
- Created the Supabase project and loaded the database into it.
- Created the Vercel account (signed in with GitHub). Step 1 is done.
- Built the first version of the staff dashboard: login with roles, calendar, trip guest lists, bookings (create, search, edit, move to another trip, cancel), tours with ticket types and sale prices, boats with maintenance blocks, schedules, and staff. Spanish and English. Setup steps are in [docs/setup.md](docs/setup.md).

## Open questions
- Does each hotel have its own prices, or one hotel price list for all?
- Do hotels collect payment from the guest, or does the guest pay us?
- Are hotels paid their commission monthly?
- Which OTAs do we use, and which brings the most bookings?
- Do we need CFDI invoices?
- How many bookings per day or month in high season? (check Rezdy reports)
