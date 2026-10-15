-- Cabo Sailing booking platform: every trip can be different.
-- "New booking" now creates the trip itself (name, type, boat, date and time,
-- duration, extra hours, guests and prices) together with the booking.
-- Tours stay as optional templates that fill in the form.
-- Paste this whole file into the Supabase SQL Editor and press "Run".

-- A one-off trip gets its own hidden tour row, so the calendar, guest lists,
-- capacity rules and prices all keep working the same way.
alter table products
  add column one_off boolean not null default false,
  -- one-off private trips: extra hours booked on this trip (charged at extra_hour_price)
  add column extra_hours int not null default 0 check (extra_hours between 0 and 12);

-- Office staff (not only admins) create one-off trips when they take a booking.
create policy office_one_off on products for insert to authenticated
  with check (one_off and has_role('admin', 'office'));
create policy office_one_off on ticket_types for insert to authenticated
  with check (has_role('admin', 'office')
              and exists (select 1 from products p where p.id = product_id and p.one_off));

-- Price quote: private one-off trips also charge their extra hours.
create or replace function quote_booking(p_departure_id bigint, p_tickets jsonb, p_guests int)
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
    if prod.extra_hours > 0 then
      unit := coalesce(prod.extra_hour_price, 0);
      items := items || jsonb_build_object(
        'description', 'Extra hour', 'ticket_type_id', null, 'quantity', prod.extra_hours, 'unit_price', unit);
      total := total + unit * prod.extra_hours;
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

-- ---------------------------------------------------------------------------
-- Create a new trip and its first booking in one step.
-- p_trip: {"name", "kind": "private"|"shared", "boat_id", "starts_at",
--          "duration_minutes", "buffer_minutes",
--   private: "base_guests" (1-4), "base_price", "extra_guests", "extra_guest_price",
--            "extra_hours", "extra_hour_price"
--   shared:  "guests" (in this booking), "guest_price", "max_guests" (seats), "min_guests"}
-- The other arguments are the same as create_booking. Returns the new booking id.
-- ---------------------------------------------------------------------------

create function create_trip_booking(
  p_trip jsonb,
  p_customer jsonb,
  p_channel booking_channel,
  p_total_override numeric default null,
  p_ota_name text default null,
  p_ota_reference text default null,
  p_occasion text default null,
  p_special_requests text default null,
  p_internal_notes text default null
) returns bigint
language plpgsql as $$
declare
  trip_name text := trim(coalesce(p_trip ->> 'name', ''));
  kind product_kind := (p_trip ->> 'kind')::product_kind;
  boat boats;
  starts timestamptz := (p_trip ->> 'starts_at')::timestamptz;
  duration int := coalesce((p_trip ->> 'duration_minutes')::int, 0);
  buffer int := coalesce((p_trip ->> 'buffer_minutes')::int, 0);
  extra_hours int := 0;
  extra_guests int := 0;
  guests int;
  prod_id bigint;
  ticket_id bigint;
  dep_id bigint;
  ends timestamptz;
begin
  if trip_name = '' then
    raise exception 'Enter the trip name';
  end if;
  select * into boat from boats where id = (p_trip ->> 'boat_id')::bigint and active;
  if not found then
    raise exception 'Choose a boat';
  end if;
  if starts is null then
    raise exception 'Choose the date and time';
  end if;
  if duration < 30 then
    raise exception 'Choose how long the trip lasts';
  end if;

  if kind = 'private' then
    extra_guests := coalesce((p_trip ->> 'extra_guests')::int, 0);
    extra_hours := coalesce((p_trip ->> 'extra_hours')::int, 0);
    guests := coalesce((p_trip ->> 'base_guests')::int, 0) + extra_guests;
    if (p_trip ->> 'base_price') is null then
      raise exception 'Enter the charter base price';
    end if;
    if extra_guests > 0 and (p_trip ->> 'extra_guest_price') is null then
      raise exception 'Enter the price per extra guest';
    end if;
    if extra_hours > 0 and (p_trip ->> 'extra_hour_price') is null then
      raise exception 'Enter the price per extra hour';
    end if;
    insert into products (name_en, name_es, kind, duration_minutes, buffer_minutes, min_guests, max_guests,
                          base_price, base_guests, extra_guest_price, max_extra_hours, extra_hours,
                          extra_hour_price, one_off)
    values (trip_name, trip_name, 'private', duration, buffer, 1, guests,
            (p_trip ->> 'base_price')::numeric, (p_trip ->> 'base_guests')::int,
            case when extra_guests > 0 then (p_trip ->> 'extra_guest_price')::numeric end,
            extra_hours, extra_hours,
            case when extra_hours > 0 then (p_trip ->> 'extra_hour_price')::numeric end,
            true)
    returning id into prod_id;
  else
    guests := coalesce((p_trip ->> 'guests')::int, 0);
    if (p_trip ->> 'guest_price') is null then
      raise exception 'Enter the price per person';
    end if;
    if coalesce((p_trip ->> 'min_guests')::int, 1) > coalesce((p_trip ->> 'max_guests')::int, boat.max_guests) then
      raise exception 'The minimum can''t be more than the seats';
    end if;
    insert into products (name_en, name_es, kind, duration_minutes, buffer_minutes, min_guests, max_guests, one_off)
    values (trip_name, trip_name, 'shared', duration, buffer,
            coalesce((p_trip ->> 'min_guests')::int, 1), (p_trip ->> 'max_guests')::int, true)
    returning id into prod_id;
    insert into ticket_types (product_id, name_en, name_es, price)
    values (prod_id, 'Per person', 'Por persona', (p_trip ->> 'guest_price')::numeric)
    returning id into ticket_id;
  end if;

  if guests < 1 then
    raise exception 'Enter the number of guests';
  end if;
  if guests > boat.max_guests then
    raise exception 'The boat holds at most % guests', boat.max_guests;
  end if;

  ends := starts + make_interval(mins => duration + extra_hours * 60);
  if exists (select 1 from boat_blocks bb
              where (bb.boat_id = boat.id or bb.boat_id is null)
                and tstzrange(bb.starts_at, bb.ends_at) && tstzrange(starts, ends + make_interval(mins => buffer))) then
    raise exception 'The boat is blocked at that time (maintenance or blackout)';
  end if;
  insert into departures (product_id, boat_id, starts_at, ends_at, boat_free_at)
  values (prod_id, boat.id, starts, ends, ends + make_interval(mins => buffer))
  returning id into dep_id;

  return create_booking(
    dep_id, p_customer, p_channel,
    case when kind = 'shared' then jsonb_build_array(jsonb_build_object('ticket_type_id', ticket_id, 'quantity', guests)) end,
    case when kind = 'private' then guests end,
    p_total_override, p_ota_name, p_ota_reference, p_occasion, p_special_requests, p_internal_notes);
end;
$$;

grant execute on function create_trip_booking(jsonb, jsonb, booking_channel, numeric, text, text, text, text, text) to authenticated;
