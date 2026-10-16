# Cabo Sailing booking platform: progress log

## Important

Platforms we use:

| Platform | What it's for | Link |
| --- | --- | --- |
| Supabase | Database and staff logins | [supabase.com/dashboard/project/kblghgkxcyrpjmjokshj](https://supabase.com/dashboard/project/kblghgkxcyrpjmjokshj) |
| **Staff dashboard** | The live system staff log in to | [booking-platform-sooty.vercel.app](https://booking-platform-sooty.vercel.app) |
| Vercel | Hosts the staff dashboard | [vercel.com/dashboard](https://vercel.com/dashboard) (project "booking-platform") |
| GitHub | Stores all the code | [github.com/itaigu/booking-platform](https://github.com/itaigu/booking-platform) |
| Stripe | Payments (added in step 4) | [dashboard.stripe.com](https://dashboard.stripe.com) |
| Rezdy | Current system, keeps running until step 4 is done | [app.rezdy.com](https://app.rezdy.com) |

Never write passwords or secret keys in this file.

**Claude and Supabase:** Claude is connected to Supabase and runs database updates itself while we only have test data. Once we start using real data (real bookings and customers), Claude must not change anything in Supabase without explicit permission each time.

**What to do next:** see [NEXT-STEPS.md](NEXT-STEPS.md).

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
- Updated the database, created the first admin login and put the dashboard online at booking-platform-sooty.vercel.app.
- Added a "change password" page: click your name at the top right.
- Calendar now shows one day at a time, with hour lines, a column per boat and a color per boat.

### 2026-10-15
- Simpler tour form: one name instead of English and Spanish, + and − counters for duration, guests included (1 to 4) and extra guests, and a price per extra hour. Start times are picked by tapping an hour and minutes instead of typing. Database update: `20261015000000_tour_options.sql` (Claude ran it directly in Supabase).
- Connected Claude to Supabase.
- Menu moved to a sidebar on the left (☰ button on phones). The calendar has a Day / Week switch; Day is the default.
- Made the dashboard look and work more like professional charter software: grouped sidebar with a logo, a cleaner calendar header (tap the date to jump to any day), trip cards with booked/capacity and a status label (Full, Booked, Below min., Cancelled), maintenance blocks and a "now" line in the week view, a day-by-day list for the week on phones, and a tour form in sections with price boxes in USD and month/day lists for the season.
- Extra hours are saved on private tours, but bookings don't add or charge them yet (needs an extra-hours counter on New booking and a quote_booking change).
- Every trip is different: New booking now creates the trip itself, with its name, type (private or shared), boat, exact date and time, duration, turnaround time, guests included and extra guests, extra hours and prices, and shows the total as you fill it in. Tours are now optional templates that fill in the form (and are still used by Schedules). To add guests to a shared trip that is already on the calendar, use the button at the top of New booking. Database update: `20261015010000_one_off_trips.sql` (Claude ran it directly in Supabase).
- Still to do: bookings on a one-off trip can't be moved to another date yet (the trip's date and time can't be edited yet either). Done on 2026-10-16.

### 2026-10-16
- Tours now only hold the basics: name, type, price (a shared tour has one price per person), guests, extra guests and hours, and duration. The season and the seasonal/sale prices sections were removed.
- New booking now starts with the customer, then a "Tipo de paseo" dropdown that fills in the trip details (all still editable).
- External review of the whole project, then fixes for what it found:
  - A trip's date, time, boat and duration can be changed (from the booking or the trip page); all its bookings move with it.
  - A booking's number of guests (and extra hours on a private trip) can be changed; the price is worked out again.
  - Cancelling the booking of a one-off trip also cancels the trip and frees the boat. Reactivating brings it back if the boat is still free.
  - History of changes on every booking: who changed what, when, and the old value. Nobody can edit it.
  - A whole trip can be cancelled at once (bad weather or another reason), with all its bookings.
  - Captains and crew only see the guest list, without prices, notes or payments.
  - The system now refuses to make a boat or tour smaller than the guests already booked, and refuses maintenance blocks on top of live trips.
  - A new booking reuses the customer if the email (or the name and phone) is already saved.
  - Admins can set a new password for staff who forget theirs (Staff page).
  - Security clean-up in Supabase and indexes so searches stay fast with many bookings.
  - Automatic tests for the database rules and the code, run by GitHub on every change.
  - Database update: `20261016000000_review_fixes.sql`. Claude ran it in Supabase in 7 parts (`review_fixes_1` to `review_fixes_7` in the migration history). Still missing there: the function `update_booking_guests` (change the number of guests). Supabase asks for an extra confirmation before creating it that can't reach the chat, so itai pastes it once in the SQL Editor.

## Open questions
- Does each hotel have its own prices, or one hotel price list for all?
- Do hotels collect payment from the guest, or does the guest pay us?
- Are hotels paid their commission monthly?
- Which OTAs do we use, and which brings the most bookings?
- Do we need CFDI invoices?
- How many bookings per day or month in high season? (check Rezdy reports)
