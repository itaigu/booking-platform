-- Cabo Sailing booking platform: initial database
-- Paste this whole file into the Supabase SQL Editor and press "Run".

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Choice lists
-- ---------------------------------------------------------------------------

create type staff_role as enum ('admin', 'office', 'dock', 'crew');
create type product_kind as enum ('shared', 'private');
create type departure_status as enum ('scheduled', 'cancelled', 'weather_cancelled');
create type booking_channel as enum ('phone', 'whatsapp', 'walk_in', 'hotel', 'ota', 'other');
create type booking_status as enum ('confirmed', 'cancelled', 'no_show', 'completed');
create type commission_status as enum ('owed', 'paid', 'cancelled');
create type payment_method as enum ('stripe', 'cash', 'card_at_dock', 'other');
create type payment_kind as enum ('payment', 'refund', 'tip');
create type crew_position as enum ('captain', 'crew');

-- ---------------------------------------------------------------------------
-- Staff (one row per person who can log in to the dashboard)
-- ---------------------------------------------------------------------------

create table staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role staff_role not null,
  phone text,
  language text not null default 'es' check (language in ('es', 'en')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Boats, tours and schedules
-- ---------------------------------------------------------------------------

create table boats (
  id bigint generated always as identity primary key,
  name text not null unique,
  length_ft int,
  max_guests int not null check (max_guests > 0),
  active boolean not null default true,
  notes text
);

create table products (
  id bigint generated always as identity primary key,
  name_en text not null,
  name_es text not null,
  kind product_kind not null,
  duration_minutes int not null check (duration_minutes > 0),
  -- cleaning / fueling time the boat needs after this trip
  buffer_minutes int not null default 0 check (buffer_minutes >= 0),
  -- shared tours: fewest guests needed for the trip to run, and most seats sold
  min_guests int not null default 1 check (min_guests > 0),
  max_guests int check (max_guests > 0),
  -- private charters: price covers up to base_guests, then extra_guest_price each
  base_price numeric(10, 2),
  base_guests int,
  extra_guest_price numeric(10, 2),
  -- seasonal products (whale watching): month/day window, e.g. 12-15 to 04-15
  season_start text check (season_start ~ '^\d{2}-\d{2}$'),
  season_end text check (season_end ~ '^\d{2}-\d{2}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind = 'shared' or (base_price is not null and base_guests is not null))
);

-- Which boats can run which tour
create table product_boats (
  product_id bigint not null references products (id) on delete cascade,
  boat_id bigint not null references boats (id) on delete cascade,
  primary key (product_id, boat_id)
);

-- Ticket types for shared tours (adult, child, ...)
create table ticket_types (
  id bigint generated always as identity primary key,
  product_id bigint not null references products (id) on delete cascade,
  name_en text not null,
  name_es text not null,
  price numeric(10, 2) not null check (price >= 0),
  active boolean not null default true
);

-- Seasonal prices / sale prices: override a ticket or charter price for a date range
create table price_rules (
  id bigint generated always as identity primary key,
  product_id bigint not null references products (id) on delete cascade,
  ticket_type_id bigint references ticket_types (id) on delete cascade,
  label text not null,              -- e.g. 'High season', 'Sale -30%'
  starts_on date not null,
  ends_on date not null,
  price numeric(10, 2),             -- fixed price, or
  percent_off numeric(5, 2),        -- a discount
  check (ends_on >= starts_on),
  check ((price is null) <> (percent_off is null))
);

create table promo_codes (
  id bigint generated always as identity primary key,
  code text not null unique,
  percent_off numeric(5, 2),
  amount_off numeric(10, 2),
  valid_from date,
  valid_to date,
  max_uses int,
  times_used int not null default 0,
  active boolean not null default true,
  check ((percent_off is null) <> (amount_off is null))
);

-- Recurring schedule: "Sunset Sailing every day at 17:00 from Nov to Apr"
create table schedules (
  id bigint generated always as identity primary key,
  product_id bigint not null references products (id) on delete cascade,
  boat_id bigint references boats (id),
  weekdays int[] not null,          -- 0 = Sunday ... 6 = Saturday
  start_time time not null,
  valid_from date not null,
  valid_to date,
  active boolean not null default true
);

-- One actual trip on one date with one boat
create table departures (
  id bigint generated always as identity primary key,
  product_id bigint not null references products (id),
  boat_id bigint not null references boats (id),
  schedule_id bigint references schedules (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- ends_at plus the product's buffer; used to stop the boat being double-booked
  boat_free_at timestamptz not null,
  status departure_status not null default 'scheduled',
  notes text,
  check (ends_at > starts_at and boat_free_at >= ends_at),
  -- a boat can never have two live trips that overlap (including buffer time)
  exclude using gist (
    boat_id with =,
    tstzrange(starts_at, boat_free_at) with &&
  ) where (status = 'scheduled')
);
create index departures_starts_at_idx on departures (starts_at);

-- Maintenance blocks (one boat) and blackout dates (boat_id empty = whole fleet)
create table boat_blocks (
  id bigint generated always as identity primary key,
  boat_id bigint references boats (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  check (ends_at > starts_at)
);

create table crew_assignments (
  departure_id bigint not null references departures (id) on delete cascade,
  staff_id uuid not null references staff (id),
  position crew_position not null,
  primary key (departure_id, staff_id)
);

-- ---------------------------------------------------------------------------
-- Hotels and their prices
-- ---------------------------------------------------------------------------

create table hotels (
  id bigint generated always as identity primary key,
  name text not null unique,
  contact_name text,
  phone text,
  email text,
  default_commission_pct numeric(5, 2) not null default 0
    check (default_commission_pct between 0 and 100),
  active boolean not null default true
);

-- Hotel price list. hotel_id empty = the price for every hotel.
create table hotel_prices (
  id bigint generated always as identity primary key,
  product_id bigint not null references products (id) on delete cascade,
  ticket_type_id bigint references ticket_types (id) on delete cascade,
  hotel_id bigint references hotels (id) on delete cascade,
  price numeric(10, 2) not null check (price >= 0)
);

-- ---------------------------------------------------------------------------
-- Customers and bookings
-- ---------------------------------------------------------------------------

create table customers (
  id bigint generated always as identity primary key,
  full_name text not null,
  email text,
  phone text,
  language text not null default 'en' check (language in ('es', 'en')),
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now()
);
create index customers_name_idx on customers (lower(full_name));
create index customers_email_idx on customers (lower(email));

create sequence booking_number_seq start 10001;

create table bookings (
  id bigint generated always as identity primary key,
  booking_number text not null unique
    default 'CS-' || nextval('booking_number_seq'),
  departure_id bigint not null references departures (id),
  customer_id bigint not null references customers (id),
  channel booking_channel not null,
  ota_name text,                    -- e.g. 'Viator' when channel = 'ota'
  ota_reference text,
  hotel_id bigint references hotels (id),
  hotel_code text,
  guests int not null check (guests > 0),
  total_price numeric(10, 2) not null check (total_price >= 0),
  promo_code_id bigint references promo_codes (id),
  status booking_status not null default 'confirmed',
  occasion text,                    -- birthday, bachelorette, ...
  special_requests text,
  internal_notes text,
  created_by uuid references staff (id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  -- hotel bookings must carry the hotel and its code; others must not
  check ((channel = 'hotel') = (hotel_id is not null and hotel_code is not null)),
  -- no promo codes or discounts on hotel bookings
  check (channel <> 'hotel' or promo_code_id is null)
);
-- one hotel code = one booking (per hotel)
create unique index bookings_hotel_code_unique on bookings (hotel_id, lower(hotel_code))
  where hotel_code is not null;
create index bookings_departure_idx on bookings (departure_id);
create index bookings_hotel_code_idx on bookings (lower(hotel_code));

-- What was bought: tickets for shared tours, or the charter itself
create table booking_items (
  id bigint generated always as identity primary key,
  booking_id bigint not null references bookings (id) on delete cascade,
  ticket_type_id bigint references ticket_types (id),
  description text not null,        -- 'Adult', 'Private charter (4 guests)', 'Extra guest', 'Shuttle'
  quantity int not null check (quantity > 0),
  unit_price numeric(10, 2) not null
);

-- Hotel commission, one per hotel booking.
-- The % is copied at the time of sale so later rate changes don't touch past bookings.
create table commissions (
  booking_id bigint primary key references bookings (id) on delete cascade,
  hotel_id bigint not null references hotels (id),
  commission_pct numeric(5, 2) not null check (commission_pct between 0 and 100),
  commission_amount numeric(10, 2) not null,
  status commission_status not null default 'owed',
  paid_at date,
  check ((status = 'paid') = (paid_at is not null))
);

create table payments (
  id bigint generated always as identity primary key,
  booking_id bigint not null references bookings (id),
  kind payment_kind not null default 'payment',
  method payment_method not null,
  amount numeric(10, 2) not null check (amount > 0),
  stripe_payment_id text,
  note text,
  recorded_by uuid references staff (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rules the database enforces on its own
-- ---------------------------------------------------------------------------

-- No overbooking: seats sold on a departure can never exceed its capacity.
-- Shared tours: capacity = product max_guests (or boat max if empty).
-- Private charters: one booking per departure, up to the boat's max.
create function check_departure_capacity() returns trigger
language plpgsql as $$
declare
  dep record;
  seats_taken int;
  other_bookings int;
  capacity int;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  -- lock the departure so two staff can't sell the last seat at the same moment
  select d.status, p.kind, p.max_guests as product_max, b.max_guests as boat_max
    into dep
    from departures d
    join products p on p.id = d.product_id
    join boats b on b.id = d.boat_id
   where d.id = new.departure_id
     for update of d;

  if dep.status <> 'scheduled' then
    raise exception 'This trip is cancelled and cannot take bookings';
  end if;

  select coalesce(sum(guests), 0), count(*)
    into seats_taken, other_bookings
    from bookings
   where departure_id = new.departure_id
     and status = 'confirmed'
     and id is distinct from new.id;

  if dep.kind = 'private' then
    if other_bookings > 0 then
      raise exception 'This private charter is already booked';
    end if;
    capacity := dep.boat_max;
  else
    capacity := least(coalesce(dep.product_max, dep.boat_max), dep.boat_max);
  end if;

  if seats_taken + new.guests > capacity then
    raise exception 'Not enough space: % of % seats already taken', seats_taken, capacity;
  end if;

  return new;
end;
$$;

create trigger bookings_capacity
  before insert or update of departure_id, guests, status on bookings
  for each row execute function check_departure_capacity();

-- A cancelled booking automatically cancels its unpaid hotel commission.
create function cancel_commission_on_booking_cancel() returns trigger
language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update commissions set status = 'cancelled'
     where booking_id = new.id and status = 'owed';
  end if;
  return new;
end;
$$;

create trigger bookings_cancel_commission
  after update of status on bookings
  for each row execute function cancel_commission_on_booking_cancel();

-- ---------------------------------------------------------------------------
-- Security: only logged-in, active staff can see or change anything.
-- (Finer per-role limits come with the dashboard in step 2.)
-- ---------------------------------------------------------------------------

create function is_active_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and active);
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and active and role = 'admin');
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'boats', 'products', 'product_boats', 'ticket_types', 'price_rules',
    'promo_codes', 'schedules', 'departures', 'boat_blocks', 'crew_assignments',
    'hotels', 'hotel_prices', 'customers', 'bookings', 'booking_items',
    'commissions', 'payments'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy staff_all on %I for all to authenticated
         using (is_active_staff()) with check (is_active_staff())', t);
  end loop;
end;
$$;

alter table staff enable row level security;
create policy staff_read on staff for select to authenticated using (is_active_staff());
create policy staff_admin_write on staff for all to authenticated
  using (is_admin()) with check (is_admin());
