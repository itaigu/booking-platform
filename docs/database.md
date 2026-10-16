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
  charter takes only one booking, of up to its guests included plus extra guests allowed.
- **No double-booked boats.** A boat can't have two trips that overlap,
  including the cleaning and fueling time after each trip.
- **One hotel code, one booking.** A hotel can't use the same code twice.
- **No discounts on hotel bookings.** A hotel booking can't have a promo code.
- **Every hotel booking gets its commission,** at the hotel's % (or a special % for that booking).
- **Commission is frozen at sale time.** The % is copied onto each booking.
- **The commission amount is always total × %,** and follows the booking total until it is paid.
  A paid commission can't change.
- **Cancelling a booking cancels its unpaid commission;** reactivating the booking brings it back.
  A no-show keeps its commission.
- **Only logged-in, active staff** can see or change anything.
- **No trips on blocked boats,** and no blocks on top of live trips.
- **Every change is kept in a history** that can't be edited.

## Still to decide

- Does each hotel have its own prices, or one hotel price list for all?
  (`hotel_prices` supports both.)
- Do hotels collect payment from the guest, or does the guest pay us?
- Do we need CFDI invoices?

## Added for the dashboard (`20261014010000_dashboard.sql`)

- **Roles:** admin manages tours, boats, schedules, prices and staff; office
  manages trips and bookings; dock and crew can view the calendar and guest lists.
- **Availability:** `departure_availability` shows seats booked and seats left per trip.
- **Trips from schedules:** `generate_departures` fills the calendar for a date
  range, skipping days out of season, already created, or with no free boat.
  The Schedules screen was taken out on 2026-10-16 (every trip is different), so
  nothing uses it now; the `schedules` table and this function are still there.
- **Prices:** `quote_booking` works out the price, including seasonal and sale prices.
- **Bookings:** `create_booking` saves the customer, booking and items in one go;
  `reschedule_booking` moves a booking to another trip of the same tour.

## Boat colors (`20261014020000_boat_colors.sql`)

- Each boat has a `color` used for its column and trips on the day calendar.

## Review fixes (`20261016000000_review_fixes.sql`)

- **Change a trip:** `update_departure` changes a trip's date, time, boat and
  duration (and the name of a one-off trip). Every booking on it moves too.
- **Change guests:** `update_booking_guests` changes the guests (and the extra
  hours of a one-off private trip) and works out the price again.
- **One-off trips follow their booking:** cancelling the last booking of a
  one-off trip cancels the trip and frees the boat; reactivating the booking
  brings the trip back if the boat is still free.
- **Cancel a whole trip:** `cancel_departure` cancels a trip and all its
  confirmed bookings, marked as bad weather or not.
- **History:** `change_log` keeps every change to bookings, trips, customers,
  payments and commissions (old value, new value, who and when). Nobody can
  edit or delete it. Admin and office can read it.
- **Captains and crew** can't read bookings, customers or payments directly.
  They see the guest list through `trip_manifest` (no prices) and seat counts
  through `departure_availability`.
- **Capacity and blocks are checked again** when a boat or tour gets smaller,
  a trip changes boat, or a maintenance block is added (it can't go on top of
  live trips).
- **Returning customers:** a new booking reuses the customer when the email
  matches, or both the name and the phone match.

## Hotel bookings (`20261016010000_hotel_bookings.sql`)

- **`create_hotel_booking`** makes a hotel booking on a trip already on the
  calendar or on a new one-off trip. It needs an active hotel and its code, and
  refuses a code that hotel already used (any case or spaces). The commission
  % is the hotel's unless the booking gives its own.
- **Commission triggers:** every hotel booking gets a commission row; the amount
  is worked out from the booking total and the %, and follows the total while
  the commission is owed.
- **`commission_lines`** (view): one line per hotel booking with the hotel, the
  trip day in Cabo time and the commission. Admin and office only.
- **`pay_hotel_commissions`** marks a hotel's owed commissions for one month
  (by trip day) as paid, only for trips that already happened.
  **`undo_hotel_commission_payment`** puts them back (admin only).
- `create_booking` and `create_trip_booking` work as before; the shared parts
  now live in `insert_booking` and `create_one_off_trip`.

## Tests

`supabase/tests/run.sh` builds the whole database from the migrations on an
empty PostgreSQL database and checks these rules. GitHub runs it on every
pull request (`.github/workflows/checks.yml`), together with the code checks.
Never point it at the real Supabase project.
