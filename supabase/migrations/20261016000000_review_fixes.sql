-- Cabo Sailing booking platform: fixes from the external review (2026-10-16).
--   1. Change a trip's date, time, boat and duration (all its bookings move with it).
--   2. Change the number of guests (and extra hours) of a booking; the price is worked out again.
--   3. Cancelling the booking of a one-off trip frees the boat; reactivating it brings the trip back.
--   4. History of every change to bookings, trips, customers, payments and commissions.
--   6. Captains and crew only see the guest list, without prices or internal notes.
--   7. Capacity and maintenance blocks are checked again when boats, tours or trips change.
--   8. Cancel a whole trip with all its bookings (for example for bad weather).
--  11. Security clean-up: fixed search_path, no anonymous access to the role functions,
--      btree_gist moved out of the public schema.
--  13. A new booking reuses the customer if the email (or the name and phone) already exists.
--  15. Indexes on the columns that link tables together.
-- Needs the earlier migrations to have run first.

-- ---------------------------------------------------------------------------
-- 11. Security clean-up
-- ---------------------------------------------------------------------------

alter extension btree_gist set schema extensions;

alter function in_season(products, date) set search_path = public;
alter function cancel_commission_on_booking_cancel() set search_path = public;
alter function set_cancelled_at() set search_path = public;
alter function quote_booking(bigint, jsonb, int) set search_path = public;
alter function local_tz() set search_path = public;
alter function price_on(bigint, bigint, numeric, date) set search_path = public;
alter function generate_departures(bigint, date, date) set search_path = public;
alter function create_trip_booking(jsonb, jsonb, booking_channel, numeric, text, text, text, text, text) set search_path = public;
alter function create_departure(bigint, bigint, timestamptz) set search_path = public;
alter function reschedule_booking(bigint, bigint) set search_path = public;

-- These run with extra rights to read the staff table; only logged-in users need them.
revoke execute on function is_active_staff(), is_admin(), my_role(), has_role(staff_role[]) from public, anon;
grant execute on function is_active_staff(), is_admin(), my_role(), has_role(staff_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 15. Indexes on the columns that link tables together
-- ---------------------------------------------------------------------------

create index if not exists boat_blocks_boat_idx on boat_blocks (boat_id);
create index if not exists booking_items_booking_idx on booking_items (booking_id);
create index if not exists booking_items_ticket_type_idx on booking_items (ticket_type_id);
create index if not exists bookings_created_by_idx on bookings (created_by);
create index if not exists bookings_customer_idx on bookings (customer_id);
create index if not exists bookings_promo_code_idx on bookings (promo_code_id);
create index if not exists commissions_hotel_idx on commissions (hotel_id);
create index if not exists crew_assignments_staff_idx on crew_assignments (staff_id);
create index if not exists departures_product_idx on departures (product_id);
create index if not exists departures_schedule_idx on departures (schedule_id);
create index if not exists hotel_prices_hotel_idx on hotel_prices (hotel_id);
create index if not exists hotel_prices_product_idx on hotel_prices (product_id);
create index if not exists hotel_prices_ticket_type_idx on hotel_prices (ticket_type_id);
create index if not exists payments_booking_idx on payments (booking_id);
create index if not exists payments_recorded_by_idx on payments (recorded_by);
create index if not exists price_rules_product_idx on price_rules (product_id);
create index if not exists price_rules_ticket_type_idx on price_rules (ticket_type_id);
create index if not exists product_boats_boat_idx on product_boats (boat_id);
create index if not exists schedules_boat_idx on schedules (boat_id);
create index if not exists schedules_product_idx on schedules (product_id);
create index if not exists ticket_types_product_idx on ticket_types (product_id);

-- ---------------------------------------------------------------------------
-- 6. Captains and crew: guest list only
-- Bookings, customers, what was bought and payments: admin, office and dock.
-- Captains and crew see the guest list through trip_manifest() and the seat
-- counts through departure_availability.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['customers', 'bookings', 'booking_items', 'payments'] loop
    execute format('drop policy staff_read on %I', t);
    execute format($p$create policy staff_read on %I for select to authenticated
      using (has_role('admin', 'office', 'dock'))$p$, t);
  end loop;
end;
$$;

-- Seats booked on a trip, for every staff member (crew can't read bookings).
create function departure_booked(p_departure_id bigint, out guests int, out bookings int)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(b.guests), 0)::int, count(*)::int
    from bookings b
   where b.departure_id = p_departure_id and b.status = 'confirmed' and is_active_staff();
$$;
revoke execute on function departure_booked(bigint) from public, anon;
grant execute on function departure_booked(bigint) to authenticated;

-- Same columns as before, plus a few the trip edit form needs at the end.
create or replace view departure_availability with (security_invoker = true) as
select
  d.id,
  d.product_id,
  d.boat_id,
  d.starts_at,
  d.ends_at,
  d.status,
  d.notes,
  p.name_en as product_name_en,
  p.name_es as product_name_es,
  p.kind,
  p.min_guests,
  b.name as boat_name,
  least(coalesce(p.max_guests, b.max_guests), b.max_guests) as capacity,
  s.guests as guests_booked,
  s.bookings as bookings_count,
  case when p.kind = 'private' then (case when s.bookings > 0 then 0 else least(coalesce(p.max_guests, b.max_guests), b.max_guests) end)
       else greatest(least(coalesce(p.max_guests, b.max_guests), b.max_guests) - s.guests, 0)
  end::int as seats_left,
  p.one_off,
  b.max_guests as boat_max,
  p.extra_hours,
  d.boat_free_at
from departures d
join products p on p.id = d.product_id
join boats b on b.id = d.boat_id
cross join lateral departure_booked(d.id) s;

-- The guest list of one trip. Prices only for admin, office and dock.
create function trip_manifest(p_departure_id bigint)
returns table (
  booking_id bigint,
  booking_number text,
  guests int,
  status booking_status,
  channel booking_channel,
  ota_name text,
  occasion text,
  special_requests text,
  full_name text,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  total_price numeric
)
language sql stable security definer set search_path = public as $$
  select b.id, b.booking_number, b.guests, b.status, b.channel, b.ota_name, b.occasion, b.special_requests,
         c.full_name, c.phone, c.emergency_contact_name, c.emergency_contact_phone,
         case when has_role('admin', 'office', 'dock') then b.total_price end
    from bookings b
    join customers c on c.id = b.customer_id
   where b.departure_id = p_departure_id and is_active_staff()
   order by b.created_at;
$$;
revoke execute on function trip_manifest(bigint) from public, anon;
grant execute on function trip_manifest(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. History of changes
-- ---------------------------------------------------------------------------

create table change_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id bigint not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  -- update: {"field": [old, new], ...}; delete: the whole old row; insert: {}
  changes jsonb not null,
  booking_id bigint,
  departure_id bigint,
  customer_id bigint,
  changed_by uuid references staff (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index change_log_booking_idx on change_log (booking_id);
create index change_log_departure_idx on change_log (departure_id);
create index change_log_customer_idx on change_log (customer_id);
create index change_log_changed_by_idx on change_log (changed_by);

-- Only the database writes the history, and nobody can change or delete it.
alter table change_log enable row level security;
create policy office_read on change_log for select to authenticated using (has_role('admin', 'office'));
revoke all on change_log from anon, authenticated;
grant select on change_log to authenticated;

create function log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(e.key, jsonb_build_array(o -> e.key, e.value)) into diff
      from jsonb_each(n) e
     where e.value is distinct from o -> e.key
       and e.key not in ('cancelled_at', 'boat_free_at', 'created_at');
    if diff is null then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    diff := '{}'::jsonb;
  else
    diff := o;
  end if;

  insert into change_log (table_name, row_id, action, changes, booking_id, departure_id, customer_id, changed_by)
  values (
    tg_table_name,
    (r ->> case when tg_table_name = 'commissions' then 'booking_id' else 'id' end)::bigint,
    lower(tg_op),
    diff,
    case when tg_table_name = 'bookings' then (r ->> 'id')::bigint else (r ->> 'booking_id')::bigint end,
    case tg_table_name when 'bookings' then (r ->> 'departure_id')::bigint
                       when 'departures' then (r ->> 'id')::bigint end,
    case tg_table_name when 'bookings' then (r ->> 'customer_id')::bigint
                       when 'customers' then (r ->> 'id')::bigint end,
    (select id from staff where id = auth.uid())
  );
  return null;
end;
$$;
revoke execute on function log_change() from public, anon, authenticated;

create trigger bookings_log after insert or update on bookings
  for each row execute function log_change();
create trigger departures_log after update on departures
  for each row execute function log_change();
create trigger customers_log after update on customers
  for each row execute function log_change();
create trigger payments_log after insert or update or delete on payments
  for each row execute function log_change();
create trigger commissions_log after insert or update on commissions
  for each row execute function log_change();

-- ---------------------------------------------------------------------------
-- 7. Maintenance blocks and capacity are checked whenever something changes
-- ---------------------------------------------------------------------------

-- A live trip can't be on a boat while it is blocked.
create function check_departure_not_blocked() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'scheduled' and exists (
    select 1 from boat_blocks bb
     where (bb.boat_id = new.boat_id or bb.boat_id is null)
       and tstzrange(bb.starts_at, bb.ends_at) && tstzrange(new.starts_at, new.boat_free_at)) then
    raise exception 'The boat is blocked at that time (maintenance or blackout)';
  end if;
  return new;
end;
$$;

create trigger departures_not_blocked
  before insert or update of boat_id, starts_at, ends_at, boat_free_at, status on departures
  for each row execute function check_departure_not_blocked();

-- A block can't be added on top of live trips; they have to be moved or cancelled first.
create function check_block_is_free() returns trigger
language plpgsql set search_path = public as $$
declare
  trips int;
begin
  select count(*) into trips
    from departures d
   where d.status = 'scheduled'
     and (new.boat_id is null or d.boat_id = new.boat_id)
     and tstzrange(d.starts_at, d.boat_free_at) && tstzrange(new.starts_at, new.ends_at);
  if trips > 0 then
    raise exception 'There are % trips at that time. Move or cancel them first', trips;
  end if;
  return new;
end;
$$;

create trigger boat_blocks_free
  before insert or update on boat_blocks
  for each row execute function check_block_is_free();

-- After a boat, tour or trip changes, every upcoming trip it touches must
-- still hold the guests already booked.
create function check_trips_still_fit() returns trigger
language plpgsql set search_path = public as $$
declare
  r record;
begin
  for r in
    select d.starts_at, s.guests,
           least(coalesce(p.max_guests, b.max_guests), b.max_guests) as capacity
      from departures d
      join products p on p.id = d.product_id
      join boats b on b.id = d.boat_id
     cross join lateral (
       select coalesce(sum(x.guests), 0)::int as guests
         from bookings x where x.departure_id = d.id and x.status = 'confirmed') s
     where d.status = 'scheduled'
       and d.boat_free_at > now()
       and case tg_table_name
             when 'boats' then d.boat_id = new.id
             when 'products' then d.product_id = new.id
             else d.id = new.id
           end
  loop
    if r.guests > r.capacity then
      raise exception 'Too many guests: % booked but only % fit (trip on %)',
        r.guests, r.capacity, to_char(r.starts_at at time zone local_tz(), 'YYYY-MM-DD HH24:MI');
    end if;
  end loop;
  return null;
end;
$$;

create trigger boats_still_fit
  after update of max_guests on boats
  for each row when (new.max_guests < old.max_guests)
  execute function check_trips_still_fit();
create trigger products_still_fit
  after update of max_guests on products
  for each row when (new.max_guests is distinct from old.max_guests)
  execute function check_trips_still_fit();
create trigger departures_still_fit
  after update of boat_id, product_id on departures
  for each row when (new.boat_id <> old.boat_id or new.product_id <> old.product_id)
  execute function check_trips_still_fit();

-- ---------------------------------------------------------------------------
-- 3. One-off trips follow their booking
-- ---------------------------------------------------------------------------

-- Same as before, plus: reactivating the booking of a one-off trip that was
-- cancelled brings the trip back (if the boat is still free).
create or replace function check_departure_capacity() returns trigger
language plpgsql set search_path = public as $$
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
  select d.status, p.kind, p.one_off, p.max_guests as product_max, b.max_guests as boat_max
    into dep
    from departures d
    join products p on p.id = d.product_id
    join boats b on b.id = d.boat_id
   where d.id = new.departure_id
     for update of d;

  if dep.status = 'cancelled' and dep.one_off and tg_op = 'UPDATE'
     and old.status <> 'confirmed' and old.departure_id = new.departure_id then
    update departures set status = 'scheduled' where id = new.departure_id;
    dep.status := 'scheduled';
  end if;

  if dep.status <> 'scheduled' then
    raise exception 'This trip is cancelled and cannot take bookings';
  end if;

  select coalesce(sum(guests), 0), count(*)
    into seats_taken, other_bookings
    from bookings
   where departure_id = new.departure_id
     and status = 'confirmed'
     and id is distinct from new.id;

  if dep.kind = 'private' and other_bookings > 0 then
    raise exception 'This private charter is already booked';
  end if;
  capacity := least(coalesce(dep.product_max, dep.boat_max), dep.boat_max);

  if seats_taken + new.guests > capacity then
    raise exception 'Not enough space: % of % seats already taken', seats_taken, capacity;
  end if;

  return new;
end;
$$;

-- Cancelling the last booking of a one-off trip cancels the trip, so the boat is free again.
create function cancel_empty_one_off_trip() returns trigger
language plpgsql set search_path = public as $$
begin
  update departures d
     set status = 'cancelled'
    from products p
   where d.id = new.departure_id
     and p.id = d.product_id
     and p.one_off
     and d.status = 'scheduled'
     and not exists (
       select 1 from bookings b
        where b.departure_id = d.id and b.status <> 'cancelled' and b.id <> new.id);
  return null;
end;
$$;

create trigger bookings_free_one_off_trip
  after update of status on bookings
  for each row when (new.status = 'cancelled' and old.status <> 'cancelled')
  execute function cancel_empty_one_off_trip();

-- Office staff can change the details of one-off trips (not the tour templates).
create policy office_one_off_update on products for update to authenticated
  using (one_off and has_role('admin', 'office'))
  with check (one_off and has_role('admin', 'office'));

-- ---------------------------------------------------------------------------
-- 1. Change a trip's date, time, boat and duration
-- Every booking on the trip moves with it. The boat must be free and not blocked.
-- p_name only changes the name of one-off trips.
-- ---------------------------------------------------------------------------

create function update_departure(
  p_departure_id bigint,
  p_boat_id bigint,
  p_starts_at timestamptz,
  p_duration_minutes int,
  p_buffer_minutes int,
  p_name text default null
) returns void
language plpgsql set search_path = public as $$
declare
  dep departures;
  prod products;
  ends timestamptz;
  buffer int := coalesce(p_buffer_minutes, 0);
begin
  if not has_role('admin', 'office') then
    raise exception 'Not allowed (row-level security)';
  end if;
  select * into dep from departures where id = p_departure_id for update;
  if not found then
    raise exception 'Trip not found';
  end if;
  if dep.status <> 'scheduled' then
    raise exception 'This trip is cancelled and cannot be changed';
  end if;
  if p_starts_at is null then
    raise exception 'Choose the date and time';
  end if;
  if coalesce(p_duration_minutes, 0) < 30 then
    raise exception 'Choose how long the trip lasts';
  end if;
  if buffer < 0 then
    raise exception 'Some information is missing or invalid';
  end if;
  if not exists (select 1 from boats where id = p_boat_id and active) then
    raise exception 'Choose a boat';
  end if;
  select * into prod from products where id = dep.product_id;

  -- extra hours booked on a one-off private trip stay on top of the duration
  ends := p_starts_at + make_interval(mins => p_duration_minutes + prod.extra_hours * 60);

  if prod.one_off then
    update products
       set duration_minutes = p_duration_minutes,
           buffer_minutes = buffer,
           name_en = coalesce(nullif(trim(p_name), ''), name_en),
           name_es = coalesce(nullif(trim(p_name), ''), name_es)
     where id = prod.id;
  end if;

  update departures
     set boat_id = p_boat_id,
         starts_at = p_starts_at,
         ends_at = ends,
         boat_free_at = ends + make_interval(mins => buffer)
   where id = dep.id;
end;
$$;

grant execute on function update_departure(bigint, bigint, timestamptz, int, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Change the guests (and, on one-off private trips, the extra hours) of a
-- booking. The items and total are worked out again; p_total_override sets a
-- special price instead.
-- ---------------------------------------------------------------------------

create function update_booking_guests(
  p_booking_id bigint,
  p_guests int,
  p_extra_hours int default null,
  p_extra_guest_price numeric default null,
  p_extra_hour_price numeric default null,
  p_total_override numeric default null
) returns void
language plpgsql set search_path = public as $$
declare
  bk bookings;
  dep departures;
  prod products;
  boat_max int;
  hours int;
  ticket bigint;
  q jsonb;
  item jsonb;
begin
  if not has_role('admin', 'office') then
    raise exception 'Not allowed (row-level security)';
  end if;
  select * into bk from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if bk.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can be changed';
  end if;
  if coalesce(p_guests, 0) < 1 then
    raise exception 'Enter the number of guests';
  end if;
  select * into dep from departures where id = bk.departure_id for update;
  select * into prod from products where id = dep.product_id;
  select max_guests into boat_max from boats where id = dep.boat_id;

  if prod.kind = 'private' and prod.one_off then
    if p_guests > boat_max then
      raise exception 'The boat holds at most % guests', boat_max;
    end if;
    hours := coalesce(p_extra_hours, prod.extra_hours);
    if p_guests > prod.base_guests and coalesce(p_extra_guest_price, prod.extra_guest_price) is null then
      raise exception 'Enter the price per extra guest';
    end if;
    if hours > 0 and coalesce(p_extra_hour_price, prod.extra_hour_price) is null then
      raise exception 'Enter the price per extra hour';
    end if;
    -- room for the new number first; the exact limit is set once the booking changes
    update products
       set max_guests = greatest(max_guests, p_guests),
           extra_guest_price = coalesce(p_extra_guest_price, extra_guest_price),
           extra_hour_price = coalesce(p_extra_hour_price, extra_hour_price),
           extra_hours = hours,
           max_extra_hours = greatest(max_extra_hours, hours)
     where id = prod.id;
    if hours <> prod.extra_hours then
      update departures
         set ends_at = ends_at + make_interval(hours => hours - prod.extra_hours),
             boat_free_at = boat_free_at + make_interval(hours => hours - prod.extra_hours)
       where id = dep.id;
    end if;
  end if;

  if prod.kind = 'shared' then
    select bi.ticket_type_id into ticket
      from booking_items bi where bi.booking_id = bk.id and bi.ticket_type_id is not null
     order by bi.id limit 1;
    if ticket is null then
      select id into ticket from ticket_types where product_id = prod.id and active order by id limit 1;
    end if;
    q := quote_booking(dep.id, jsonb_build_array(jsonb_build_object('ticket_type_id', ticket, 'quantity', p_guests)), null);
  else
    q := quote_booking(dep.id, null, p_guests);
  end if;

  update bookings
     set guests = (q ->> 'guests')::int,
         total_price = coalesce(p_total_override, (q ->> 'total')::numeric)
   where id = bk.id;

  if prod.kind = 'private' and prod.one_off then
    update products set max_guests = p_guests where id = prod.id;
  end if;

  delete from booking_items where booking_id = bk.id;
  for item in select * from jsonb_array_elements(q -> 'items') loop
    insert into booking_items (booking_id, ticket_type_id, description, quantity, unit_price)
    values (bk.id, (item ->> 'ticket_type_id')::bigint, item ->> 'description',
            (item ->> 'quantity')::int, (item ->> 'unit_price')::numeric);
  end loop;
end;
$$;

grant execute on function update_booking_guests(bigint, int, int, numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Cancel a whole trip and all its confirmed bookings at once.
-- p_weather marks it as cancelled for bad weather. Returns how many bookings were cancelled.
-- ---------------------------------------------------------------------------

create function cancel_departure(p_departure_id bigint, p_weather boolean default false)
returns int
language plpgsql set search_path = public as $$
declare
  cancelled int;
begin
  if not has_role('admin', 'office') then
    raise exception 'Not allowed (row-level security)';
  end if;
  update departures
     set status = (case when p_weather then 'weather_cancelled' else 'cancelled' end)::departure_status
   where id = p_departure_id and status = 'scheduled';
  if not found then
    raise exception 'This trip is already cancelled';
  end if;
  update bookings set status = 'cancelled'
   where departure_id = p_departure_id and status = 'confirmed';
  get diagnostics cancelled = row_count;
  return cancelled;
end;
$$;

grant execute on function cancel_departure(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. A new booking reuses the customer when the email matches, or the name
-- and phone both match. Empty details on the saved customer are filled in.
-- ---------------------------------------------------------------------------

create or replace function create_booking(
  p_departure_id bigint,
  p_customer jsonb,
  p_channel booking_channel,
  p_tickets jsonb,
  p_guests int,
  p_total_override numeric default null,
  p_ota_name text default null,
  p_ota_reference text default null,
  p_occasion text default null,
  p_special_requests text default null,
  p_internal_notes text default null
) returns bigint
language plpgsql set search_path = public as $$
declare
  q jsonb;
  cust_id bigint;
  booking_id bigint;
  item jsonb;
  c_name text := trim(coalesce(p_customer ->> 'full_name', ''));
  c_email text := nullif(trim(p_customer ->> 'email'), '');
  c_phone text := nullif(trim(p_customer ->> 'phone'), '');
  c_digits text := nullif(regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g'), '');
begin
  if p_channel = 'hotel' then
    raise exception 'Hotel bookings are entered from the hotel booking form';
  end if;

  q := quote_booking(p_departure_id, p_tickets, p_guests);

  if (p_customer ->> 'id') is not null then
    cust_id := (p_customer ->> 'id')::bigint;
  else
    if c_name = '' then
      raise exception 'Enter the customer''s name';
    end if;

    select id into cust_id from customers
     where c_email is not null and lower(email) = lower(c_email)
     order by id limit 1;
    if cust_id is null and c_digits is not null then
      select id into cust_id from customers
       where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = c_digits
         and lower(trim(full_name)) = lower(c_name)
       order by id limit 1;
    end if;

    if cust_id is not null then
      update customers
         set email = coalesce(email, c_email),
             phone = coalesce(phone, c_phone),
             emergency_contact_name = coalesce(emergency_contact_name, nullif(trim(p_customer ->> 'emergency_contact_name'), '')),
             emergency_contact_phone = coalesce(emergency_contact_phone, nullif(trim(p_customer ->> 'emergency_contact_phone'), ''))
       where id = cust_id;
    else
      insert into customers (full_name, email, phone, language, emergency_contact_name, emergency_contact_phone)
      values (c_name, c_email, c_phone,
              coalesce(nullif(p_customer ->> 'language', ''), 'en'),
              nullif(trim(p_customer ->> 'emergency_contact_name'), ''),
              nullif(trim(p_customer ->> 'emergency_contact_phone'), ''))
      returning id into cust_id;
    end if;
  end if;

  insert into bookings (departure_id, customer_id, channel, ota_name, ota_reference, guests,
                        total_price, occasion, special_requests, internal_notes, created_by)
  values (p_departure_id, cust_id, p_channel, nullif(p_ota_name, ''), nullif(p_ota_reference, ''),
          (q ->> 'guests')::int, coalesce(p_total_override, (q ->> 'total')::numeric),
          nullif(p_occasion, ''), nullif(p_special_requests, ''), nullif(p_internal_notes, ''),
          auth.uid())
  returning id into booking_id;

  for item in select * from jsonb_array_elements(q -> 'items') loop
    insert into booking_items (booking_id, ticket_type_id, description, quantity, unit_price)
    values (booking_id, (item ->> 'ticket_type_id')::bigint, item ->> 'description',
            (item ->> 'quantity')::int, (item ->> 'unit_price')::numeric);
  end loop;

  return booking_id;
end;
$$;

create index if not exists customers_phone_digits_idx on customers (regexp_replace(coalesce(phone, ''), '\D', '', 'g'));
