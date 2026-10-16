-- Cabo Sailing booking platform: hotel bookings and commissions.
--   Hotel bookings from both booking forms (a new trip or a trip already on the
--   calendar), with the hotel, its code and the commission %.
--   The database creates the commission with every hotel booking, and its
--   amount follows the booking total.
--   A cancelled booking cancels its commission; reactivating it brings it back.
--   Commission report lines, and marking a hotel's month as paid.
-- Needs the earlier migrations to have run first.

-- ---------------------------------------------------------------------------
-- The booking itself, shared by every booking form (now with the hotel and its code).
-- ---------------------------------------------------------------------------

create function insert_booking(
  p_departure_id bigint,
  p_customer jsonb,
  p_channel booking_channel,
  p_tickets jsonb,
  p_guests int,
  p_total_override numeric,
  p_ota_name text,
  p_ota_reference text,
  p_occasion text,
  p_special_requests text,
  p_internal_notes text,
  p_hotel_id bigint,
  p_hotel_code text
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
  q := quote_booking(p_departure_id, p_tickets, p_guests);

  if (p_customer ->> 'id') is not null then
    cust_id := (p_customer ->> 'id')::bigint;
  else
    if c_name = '' then
      raise exception 'Enter the customer''s name';
    end if;

    -- the same customer when the email matches, or the name and phone both match
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

  insert into bookings (departure_id, customer_id, channel, ota_name, ota_reference, hotel_id, hotel_code,
                        guests, total_price, occasion, special_requests, internal_notes, created_by)
  values (p_departure_id, cust_id, p_channel, nullif(p_ota_name, ''), nullif(p_ota_reference, ''),
          p_hotel_id, p_hotel_code,
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

-- Same as before; hotel bookings go through create_hotel_booking.
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
begin
  if p_channel = 'hotel' then
    raise exception 'Choose the hotel';
  end if;
  return insert_booking(p_departure_id, p_customer, p_channel, p_tickets, p_guests, p_total_override,
                        p_ota_name, p_ota_reference, p_occasion, p_special_requests, p_internal_notes,
                        null, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- A new one-off trip, shared by "New booking" for every channel.
-- p_trip is described above create_trip_booking (20261015010000_one_off_trips.sql).
-- Returns the trip, and its ticket (shared trips) and the guests of the first booking.
-- ---------------------------------------------------------------------------

create function create_one_off_trip(
  p_trip jsonb,
  out new_departure_id bigint,
  out new_ticket_id bigint,
  out new_guests int
)
language plpgsql set search_path = public as $$
declare
  trip_name text := trim(coalesce(p_trip ->> 'name', ''));
  kind product_kind := (p_trip ->> 'kind')::product_kind;
  boat boats;
  starts timestamptz := (p_trip ->> 'starts_at')::timestamptz;
  duration int := coalesce((p_trip ->> 'duration_minutes')::int, 0);
  buffer int := coalesce((p_trip ->> 'buffer_minutes')::int, 0);
  extra_hours int := 0;
  extra_guests int := 0;
  prod_id bigint;
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
    new_guests := coalesce((p_trip ->> 'base_guests')::int, 0) + extra_guests;
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
    values (trip_name, trip_name, 'private', duration, buffer, 1, new_guests,
            (p_trip ->> 'base_price')::numeric, (p_trip ->> 'base_guests')::int,
            case when extra_guests > 0 then (p_trip ->> 'extra_guest_price')::numeric end,
            extra_hours, extra_hours,
            case when extra_hours > 0 then (p_trip ->> 'extra_hour_price')::numeric end,
            true)
    returning id into prod_id;
  else
    new_guests := coalesce((p_trip ->> 'guests')::int, 0);
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
    returning id into new_ticket_id;
  end if;

  if new_guests < 1 then
    raise exception 'Enter the number of guests';
  end if;
  if new_guests > boat.max_guests then
    raise exception 'The boat holds at most % guests', boat.max_guests;
  end if;

  ends := starts + make_interval(mins => duration + extra_hours * 60);
  insert into departures (product_id, boat_id, starts_at, ends_at, boat_free_at)
  values (prod_id, boat.id, starts, ends, ends + make_interval(mins => buffer))
  returning id into new_departure_id;
end;
$$;

-- Same as before, now using create_one_off_trip.
create or replace function create_trip_booking(
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
language plpgsql set search_path = public as $$
declare
  trip record;
begin
  select * into trip from create_one_off_trip(p_trip);
  return create_booking(
    trip.new_departure_id, p_customer, p_channel,
    case when trip.new_ticket_id is not null
         then jsonb_build_array(jsonb_build_object('ticket_type_id', trip.new_ticket_id, 'quantity', trip.new_guests)) end,
    case when trip.new_ticket_id is null then trip.new_guests end,
    p_total_override, p_ota_name, p_ota_reference, p_occasion, p_special_requests, p_internal_notes);
end;
$$;

-- ---------------------------------------------------------------------------
-- A hotel booking, on a trip already on the calendar (p_departure_id, with
-- p_tickets or p_guests) or on a new trip (p_trip, as in create_trip_booking).
-- p_hotel: {"hotel_id", "code", "commission_pct"}; no commission_pct = the hotel's default.
-- Returns the new booking id.
-- ---------------------------------------------------------------------------

create function create_hotel_booking(
  p_hotel jsonb,
  p_customer jsonb,
  p_departure_id bigint default null,
  p_trip jsonb default null,
  p_tickets jsonb default null,
  p_guests int default null,
  p_total_override numeric default null,
  p_occasion text default null,
  p_special_requests text default null,
  p_internal_notes text default null
) returns bigint
language plpgsql set search_path = public as $$
declare
  h hotels;
  code text := nullif(trim(coalesce(p_hotel ->> 'code', '')), '');
  pct numeric := nullif(trim(coalesce(p_hotel ->> 'commission_pct', '')), '')::numeric;
  used text;
  dep_id bigint := p_departure_id;
  n_tickets jsonb := p_tickets;
  n_guests int := p_guests;
  trip record;
  new_id bigint;
begin
  select * into h from hotels where id = (p_hotel ->> 'hotel_id')::bigint and active;
  if not found then
    raise exception 'Choose the hotel';
  end if;
  if code is null then
    raise exception 'Enter the hotel code';
  end if;
  -- one code = one booking, so a hotel can't claim the same sale twice
  select b.booking_number into used from bookings b
   where b.hotel_id = h.id and lower(b.hotel_code) = lower(code) limit 1;
  if found then
    raise exception 'This hotel code was already used (booking %)', used;
  end if;
  if pct is not null and (pct < 0 or pct > 100) then
    raise exception 'The commission must be between 0 and 100';
  end if;

  if p_trip is not null then
    select * into trip from create_one_off_trip(p_trip);
    dep_id := trip.new_departure_id;
    if trip.new_ticket_id is not null then
      n_tickets := jsonb_build_array(jsonb_build_object('ticket_type_id', trip.new_ticket_id, 'quantity', trip.new_guests));
      n_guests := null;
    else
      n_tickets := null;
      n_guests := trip.new_guests;
    end if;
  end if;

  new_id := insert_booking(dep_id, p_customer, 'hotel', n_tickets, n_guests, p_total_override, null, null,
                           p_occasion, p_special_requests, p_internal_notes, h.id, code);
  if pct is not null then
    update commissions c set commission_pct = pct where c.booking_id = new_id;
  end if;
  return new_id;
end;
$$;

revoke execute on function create_hotel_booking(jsonb, jsonb, bigint, jsonb, jsonb, int, numeric, text, text, text) from public, anon;
grant execute on function create_hotel_booking(jsonb, jsonb, bigint, jsonb, jsonb, int, numeric, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The commission follows its booking
-- ---------------------------------------------------------------------------

-- Every hotel booking gets its commission, at the hotel's default %.
create function create_hotel_commission() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into commissions (booking_id, hotel_id, commission_pct, commission_amount)
  select new.id, h.id, h.default_commission_pct, 0
    from hotels h where h.id = new.hotel_id;
  return null;
end;
$$;

create trigger bookings_hotel_commission
  after insert on bookings
  for each row when (new.channel = 'hotel')
  execute function create_hotel_commission();

-- The amount is always the booking total times the %. A paid commission can't change.
create function set_commission_amount() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.status = 'paid' and new.status = 'paid'
     and (new.commission_pct is distinct from old.commission_pct
          or new.commission_amount is distinct from old.commission_amount) then
    raise exception 'This commission was already paid';
  end if;
  new.commission_amount := round(
    (select b.total_price from bookings b where b.id = new.booking_id) * new.commission_pct / 100, 2);
  return new;
end;
$$;

create trigger commissions_amount
  before insert or update of commission_pct, commission_amount on commissions
  for each row execute function set_commission_amount();

-- A new booking total works out the unpaid commission again.
create function hotel_commission_follows_total() returns trigger
language plpgsql set search_path = public as $$
begin
  -- commissions_amount works the amount out again from the new total
  update commissions set commission_pct = commission_pct
   where booking_id = new.id and status = 'owed';
  return null;
end;
$$;

create trigger bookings_commission_total
  after update of total_price on bookings
  for each row when (new.channel = 'hotel' and new.total_price is distinct from old.total_price)
  execute function hotel_commission_follows_total();

-- Same as before, plus: reactivating a cancelled booking brings its commission back.
-- A no-show keeps its commission (the customer still paid).
create or replace function cancel_commission_on_booking_cancel() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update commissions set status = 'cancelled'
     where booking_id = new.id and status = 'owed';
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    update commissions set status = 'owed', commission_pct = commission_pct
     where booking_id = new.id and status = 'cancelled';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Commission report: one line per hotel booking, with the trip day (Cabo time).
-- ---------------------------------------------------------------------------

create view commission_lines with (security_invoker = true) as
select
  c.booking_id,
  c.hotel_id,
  h.name as hotel_name,
  c.commission_pct,
  c.commission_amount,
  c.status,
  c.paid_at,
  b.booking_number,
  b.hotel_code,
  b.guests,
  b.total_price,
  b.status as booking_status,
  d.starts_at,
  (d.starts_at at time zone local_tz())::date as trip_day,
  p.name_en as product_name_en,
  p.name_es as product_name_es,
  cu.full_name as customer_name
from commissions c
join hotels h on h.id = c.hotel_id
join bookings b on b.id = c.booking_id
join departures d on d.id = b.departure_id
join products p on p.id = d.product_id
join customers cu on cu.id = b.customer_id;

revoke all on commission_lines from anon;
grant select on commission_lines to authenticated;

-- Mark a hotel's commissions for one month (by trip day) as paid.
-- Only trips that already happened; returns how many were marked.
create function pay_hotel_commissions(p_hotel_id bigint, p_month date, p_paid_at date)
returns int
language plpgsql set search_path = public as $$
declare
  n int;
begin
  if not has_role('admin', 'office') then
    raise exception 'Not allowed (row-level security)';
  end if;
  if p_month is null or p_paid_at is null then
    raise exception 'Choose the payment date';
  end if;
  update commissions c
     set status = 'paid', paid_at = p_paid_at
    from bookings b
    join departures d on d.id = b.departure_id
   where b.id = c.booking_id
     and c.hotel_id = p_hotel_id
     and c.status = 'owed'
     and d.starts_at < now()
     and (d.starts_at at time zone local_tz())::date >= date_trunc('month', p_month)::date
     and (d.starts_at at time zone local_tz())::date < (date_trunc('month', p_month) + interval '1 month')::date;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Nothing to mark as paid for that month';
  end if;
  return n;
end;
$$;

-- Undo a payment marked by mistake (admin only). Returns how many went back to owed.
create function undo_hotel_commission_payment(p_hotel_id bigint, p_month date)
returns int
language plpgsql set search_path = public as $$
declare
  n int;
begin
  if not has_role('admin') then
    raise exception 'Not allowed (row-level security)';
  end if;
  update commissions c
     set status = (case when b.status = 'cancelled' then 'cancelled' else 'owed' end)::commission_status,
         paid_at = null,
         commission_pct = c.commission_pct
    from bookings b
    join departures d on d.id = b.departure_id
   where b.id = c.booking_id
     and c.hotel_id = p_hotel_id
     and c.status = 'paid'
     and (d.starts_at at time zone local_tz())::date >= date_trunc('month', p_month)::date
     and (d.starts_at at time zone local_tz())::date < (date_trunc('month', p_month) + interval '1 month')::date;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function pay_hotel_commissions(bigint, date, date) from public, anon;
grant execute on function pay_hotel_commissions(bigint, date, date) to authenticated;
revoke execute on function undo_hotel_commission_payment(bigint, date) from public, anon;
grant execute on function undo_hotel_commission_payment(bigint, date) to authenticated;
