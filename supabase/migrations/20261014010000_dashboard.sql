-- Cabo Sailing booking platform: dashboard support (step 2)
-- Paste this whole file into the Supabase SQL Editor and press "Run".
-- Needs 20261014000000_initial_schema.sql to have run first.

-- Cabo San Lucas local time (no daylight saving).
create function local_tz() returns text language sql immutable as $$ select 'America/Mazatlan' $$;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create function my_role() returns staff_role
language sql stable security definer set search_path = public as $$
  select role from staff where id = auth.uid() and active;
$$;

create function has_role(variadic roles staff_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = any (roles), false);
$$;

grant execute on function my_role(), has_role(staff_role[]) to authenticated;

-- Replace the "any staff can do anything" policies with per-role ones:
--   setup (boats, tours, prices, schedules, hotels): everyone reads, admin writes
--   calendar (departures, crew): everyone reads, admin + office write
--   bookings and customers: everyone reads (manifest), admin + office write
--   commissions: admin + office only
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
    execute format('drop policy staff_all on %I', t);
  end loop;

  foreach t in array array[
    'boats', 'products', 'product_boats', 'ticket_types', 'price_rules',
    'promo_codes', 'schedules', 'boat_blocks', 'hotels', 'hotel_prices'
  ] loop
    execute format('create policy staff_read on %I for select to authenticated using (is_active_staff())', t);
    execute format($p$create policy admin_write on %I for all to authenticated
      using (has_role('admin')) with check (has_role('admin'))$p$, t);
  end loop;

  foreach t in array array[
    'departures', 'crew_assignments', 'customers', 'bookings', 'booking_items', 'payments'
  ] loop
    execute format('create policy staff_read on %I for select to authenticated using (is_active_staff())', t);
    execute format($p$create policy office_write on %I for all to authenticated
      using (has_role('admin', 'office')) with check (has_role('admin', 'office'))$p$, t);
  end loop;
end;
$$;

create policy office_all on commissions for all to authenticated
  using (has_role('admin', 'office')) with check (has_role('admin', 'office'));

-- ---------------------------------------------------------------------------
-- Availability: seats taken and seats left on every trip
-- ---------------------------------------------------------------------------

create view departure_availability with (security_invoker = true) as
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
  case when p.kind = 'private' then b.max_guests
       else least(coalesce(p.max_guests, b.max_guests), b.max_guests) end as capacity,
  coalesce(s.guests, 0)::int as guests_booked,
  coalesce(s.bookings, 0)::int as bookings_count,
  case when p.kind = 'private' then (case when coalesce(s.bookings, 0) > 0 then 0 else b.max_guests end)
       else greatest(least(coalesce(p.max_guests, b.max_guests), b.max_guests) - coalesce(s.guests, 0), 0)
  end::int as seats_left
from departures d
join products p on p.id = d.product_id
join boats b on b.id = d.boat_id
left join (
  select departure_id, sum(guests) as guests, count(*) as bookings
    from bookings where status = 'confirmed'
   group by departure_id
) s on s.departure_id = d.id;

grant select on departure_availability to authenticated;

-- ---------------------------------------------------------------------------
-- Turn a recurring schedule into real trips for a date range.
-- Skips days outside the tour's season, days that already have the trip,
-- and days the boat is blocked or busy. Returns how many trips were created.
-- ---------------------------------------------------------------------------

create function in_season(p products, day date) returns boolean
language sql immutable as $$
  select case
    when p.season_start is null or p.season_end is null then true
    when p.season_start <= p.season_end then to_char(day, 'MM-DD') between p.season_start and p.season_end
    else to_char(day, 'MM-DD') >= p.season_start or to_char(day, 'MM-DD') <= p.season_end
  end;
$$;

create function generate_departures(p_schedule_id bigint, p_from date, p_to date)
returns int
language plpgsql as $$
declare
  sch schedules;
  prod products;
  day date;
  boat bigint;
  start_ts timestamptz;
  end_ts timestamptz;
  free_ts timestamptz;
  created int := 0;
begin
  select * into sch from schedules where id = p_schedule_id;
  if not found then
    raise exception 'Schedule not found';
  end if;
  select * into prod from products where id = sch.product_id;

  if p_to - p_from > 366 then
    raise exception 'Choose a range of one year or less';
  end if;

  for day in select generate_series(greatest(p_from, sch.valid_from), least(p_to, coalesce(sch.valid_to, p_to)), '1 day')::date loop
    continue when not (extract(dow from day)::int = any (sch.weekdays));
    continue when not in_season(prod, day);

    start_ts := (day + sch.start_time) at time zone local_tz();
    end_ts := start_ts + make_interval(mins => prod.duration_minutes);
    free_ts := end_ts + make_interval(mins => prod.buffer_minutes);

    -- already created from this schedule on this day
    continue when exists (
      select 1 from departures where schedule_id = sch.id and starts_at = start_ts);

    -- the schedule's boat, or else the smallest free boat linked to this tour
    boat := null;
    for boat in
      select b.id from boats b
       where b.active
         and (b.id = sch.boat_id
              or (sch.boat_id is null and b.id in (select boat_id from product_boats where product_id = prod.id)))
       order by b.max_guests
    loop
      exit when not exists (
          select 1 from departures d
           where d.boat_id = boat and d.status = 'scheduled'
             and tstzrange(d.starts_at, d.boat_free_at) && tstzrange(start_ts, free_ts))
        and not exists (
          select 1 from boat_blocks bb
           where (bb.boat_id = boat or bb.boat_id is null)
             and tstzrange(bb.starts_at, bb.ends_at) && tstzrange(start_ts, free_ts));
      boat := null;
    end loop;
    continue when boat is null;

    insert into departures (product_id, boat_id, schedule_id, starts_at, ends_at, boat_free_at)
    values (prod.id, boat, sch.id, start_ts, end_ts, free_ts);
    created := created + 1;
  end loop;

  return created;
end;
$$;

grant execute on function generate_departures(bigint, date, date) to authenticated;

-- Create a single one-off trip (e.g. a custom private charter).
create function create_departure(p_product_id bigint, p_boat_id bigint, p_starts_at timestamptz)
returns bigint
language plpgsql as $$
declare
  prod products;
  new_id bigint;
begin
  select * into prod from products where id = p_product_id;
  if not found then
    raise exception 'Tour not found';
  end if;
  if exists (select 1 from boat_blocks bb
              where (bb.boat_id = p_boat_id or bb.boat_id is null)
                and tstzrange(bb.starts_at, bb.ends_at) &&
                    tstzrange(p_starts_at, p_starts_at + make_interval(mins => prod.duration_minutes + prod.buffer_minutes))) then
    raise exception 'The boat is blocked at that time (maintenance or blackout)';
  end if;
  insert into departures (product_id, boat_id, starts_at, ends_at, boat_free_at)
  values (p_product_id, p_boat_id, p_starts_at,
          p_starts_at + make_interval(mins => prod.duration_minutes),
          p_starts_at + make_interval(mins => prod.duration_minutes + prod.buffer_minutes))
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function create_departure(bigint, bigint, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Prices
-- ---------------------------------------------------------------------------

-- Price of one ticket type (or of a private charter's base / extra guest)
-- on a given day, after seasonal and sale prices.
create function price_on(p_product_id bigint, p_ticket_type_id bigint, p_base numeric, p_day date)
returns numeric
language sql stable as $$
  select coalesce(
    (select case when r.price is not null then r.price
                 else round(p_base * (1 - r.percent_off / 100), 2) end
       from price_rules r
      where r.product_id = p_product_id
        and (r.ticket_type_id = p_ticket_type_id or r.ticket_type_id is null)
        and p_day between r.starts_on and r.ends_on
        -- a fixed price only replaces the thing it names
        and (r.price is null or r.ticket_type_id is not distinct from p_ticket_type_id)
      order by (r.ticket_type_id is not null) desc, r.id desc
      limit 1),
    p_base);
$$;

-- Price quote for a booking.
--   shared tours:  p_tickets = [{"ticket_type_id": 1, "quantity": 2}, ...]
--   private:       p_guests = number of guests
-- Returns {"total": 123.00, "guests": 4, "items": [{description, ticket_type_id, quantity, unit_price}]}
create function quote_booking(p_departure_id bigint, p_tickets jsonb, p_guests int)
returns jsonb
language plpgsql stable as $$
declare
  dep departures;
  prod products;
  day date;
  items jsonb := '[]'::jsonb;
  total numeric := 0;
  guests int := 0;
  t record;
  unit numeric;
  extra int;
begin
  select * into dep from departures where id = p_departure_id;
  if not found then
    raise exception 'Trip not found';
  end if;
  select * into prod from products where id = dep.product_id;
  day := (dep.starts_at at time zone local_tz())::date;

  if prod.kind = 'private' then
    guests := coalesce(p_guests, 0);
    if guests < 1 then
      raise exception 'Enter the number of guests';
    end if;
    unit := price_on(prod.id, null, prod.base_price, day);
    items := items || jsonb_build_object(
      'description', format('Private charter (up to %s guests)', prod.base_guests),
      'ticket_type_id', null, 'quantity', 1, 'unit_price', unit);
    total := unit;
    extra := greatest(guests - prod.base_guests, 0);
    if extra > 0 then
      unit := price_on(prod.id, null, coalesce(prod.extra_guest_price, 0), day);
      items := items || jsonb_build_object(
        'description', 'Extra guest', 'ticket_type_id', null, 'quantity', extra, 'unit_price', unit);
      total := total + unit * extra;
    end if;
  else
    for t in
      select tt.id, tt.name_en, tt.price, (x ->> 'quantity')::int as qty
        from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) x
        join ticket_types tt on tt.id = (x ->> 'ticket_type_id')::bigint
       where tt.product_id = prod.id and (x ->> 'quantity')::int > 0
    loop
      unit := price_on(prod.id, t.id, t.price, day);
      items := items || jsonb_build_object(
        'description', t.name_en, 'ticket_type_id', t.id, 'quantity', t.qty, 'unit_price', unit);
      total := total + unit * t.qty;
      guests := guests + t.qty;
    end loop;
    if guests < 1 then
      raise exception 'Choose at least one ticket';
    end if;
  end if;

  return jsonb_build_object('total', total, 'guests', guests, 'items', items);
end;
$$;

grant execute on function price_on(bigint, bigint, numeric, date) to authenticated;
grant execute on function quote_booking(bigint, jsonb, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Create a booking in one step (customer + booking + items).
-- p_customer: {"id": 5} for an existing customer, or
--             {"full_name": "...", "email": "...", "phone": "...", "language": "en",
--              "emergency_contact_name": "...", "emergency_contact_phone": "..."}
-- p_total_override: optional special price agreed by staff.
-- Returns the new booking id.
-- ---------------------------------------------------------------------------

create function create_booking(
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
language plpgsql as $$
declare
  q jsonb;
  cust_id bigint;
  booking_id bigint;
  item jsonb;
begin
  if p_channel = 'hotel' then
    raise exception 'Hotel bookings are entered from the hotel booking form';
  end if;

  q := quote_booking(p_departure_id, p_tickets, p_guests);

  if (p_customer ->> 'id') is not null then
    cust_id := (p_customer ->> 'id')::bigint;
  else
    if coalesce(trim(p_customer ->> 'full_name'), '') = '' then
      raise exception 'Enter the customer''s name';
    end if;
    insert into customers (full_name, email, phone, language, emergency_contact_name, emergency_contact_phone)
    values (trim(p_customer ->> 'full_name'),
            nullif(trim(p_customer ->> 'email'), ''),
            nullif(trim(p_customer ->> 'phone'), ''),
            coalesce(nullif(p_customer ->> 'language', ''), 'en'),
            nullif(trim(p_customer ->> 'emergency_contact_name'), ''),
            nullif(trim(p_customer ->> 'emergency_contact_phone'), ''))
    returning id into cust_id;
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

grant execute on function create_booking(bigint, jsonb, booking_channel, jsonb, int, numeric, text, text, text, text, text) to authenticated;

-- Move a booking to another trip of the same tour. Capacity is checked by the
-- existing bookings trigger.
create function reschedule_booking(p_booking_id bigint, p_departure_id bigint)
returns void
language plpgsql as $$
declare
  old_product bigint;
  new_product bigint;
begin
  select d.product_id into old_product from bookings b join departures d on d.id = b.departure_id where b.id = p_booking_id;
  select product_id into new_product from departures where id = p_departure_id;
  if old_product is distinct from new_product then
    raise exception 'A booking can only move to another trip of the same tour';
  end if;
  update bookings set departure_id = p_departure_id where id = p_booking_id;
end;
$$;

grant execute on function reschedule_booking(bigint, bigint) to authenticated;

-- Keep cancelled_at in step with status.
create function set_cancelled_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
  elsif new.status <> 'cancelled' then
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;

create trigger bookings_cancelled_at
  before update of status on bookings
  for each row execute function set_cancelled_at();

grant execute on function in_season(products, date), local_tz() to authenticated;
