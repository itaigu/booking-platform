# Database overview

The database lives in Supabase. Its full definition is in
`supabase/migrations/20261014000000_initial_schema.sql`.

## What it stores

| Area | Tables |
| --- | --- |
| Staff | `staff` (name, role: admin / office / dock / crew, language) |
| Fleet | `boats`, `boat_blocks` (maintenance and blackout dates) |
| Tours | `products` (shared tour or private charter), `product_boats`, `ticket_types`, `price_rules` (seasonal and sale prices), `promo_codes` |
| Calendar | `schedules` (recurring times), `departures` (one real trip, one boat, one date), `crew_assignments` |
| Hotels | `hotels`, `hotel_prices` |
| Bookings | `customers`, `bookings`, `booking_items`, `commissions`, `payments` |

## Rules the database enforces by itself

These hold no matter which screen or channel a booking comes from:

- **No overbooking.** A shared tour can't sell more seats than it has. A private
  charter takes only one booking.
- **No double-booked boats.** A boat can't have two trips that overlap,
  including the cleaning and fueling time after each trip.
- **One hotel code, one booking.** A hotel can't use the same code twice.
- **No discounts on hotel bookings.** A hotel booking can't have a promo code.
- **Commission is frozen at sale time.** The % is copied onto each booking.
- **Cancelling a booking cancels its unpaid commission.**
- **Only logged-in, active staff** can see or change anything.

## Still to decide

- Does each hotel have its own prices, or one hotel price list for all?
  (`hotel_prices` supports both.)
- Do hotels collect payment from the guest, or does the guest pay us?
- Do we need CFDI invoices?
