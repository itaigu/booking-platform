-- Cabo Sailing booking platform: the daily manifest.
--   1. Pickup time and place, and check-in, on every booking.
--   2. day_manifest(): every booking of every trip on one day, for the Manifest page.
--   3. set_check_in(): mark a group as arrived (or undo it). Every staff role can do it,
--      captains and crew included, because check-in happens at the dock.

-- ---------------------------------------------------------------------------
-- 1. New columns on bookings
-- ---------------------------------------------------------------------------

alter table bookings
  add column pickup_time time,
  add column pickup_place text,
  add column checked_in_at timestamptz,
  add column checked_in_by uuid references staff (id) on delete set null;
create index if not exists bookings_checked_in_by_idx on bookings (checked_in_by);

-- ---------------------------------------------------------------------------
-- 2. Every booking on one day (Cabo time), trip by trip
-- Money and internal notes only for admin, office and dock; empty for captains and crew.
-- Cancelled bookings are left out.
-- ---------------------------------------------------------------------------

create function day_manifest(p_day date)
returns table (
  departure_id bigint,
  booking_id bigint,
  booking_number text,
  guests int,
  status booking_status,
  channel booking_channel,
  ota_name text,
  hotel_name text,
  occasion text,
  special_requests text,
  internal_notes text,
  full_name text,
  phone text,
  pickup_time time,
  pickup_place text,
  checked_in_at timestamptz,
  items text,
  total_price numeric,
  paid numeric
)
language sql stable security definer set search_path = public as $$
  select b.departure_id, b.id, b.booking_number, b.guests, b.status, b.channel, b.ota_name, h.name,
         b.occasion, b.special_requests,
         case when has_role('admin', 'office', 'dock') then b.internal_notes end,
         c.full_name, c.phone, b.pickup_time, b.pickup_place, b.checked_in_at,
         (select string_agg(i.quantity || ' × ' || i.description, ', ' order by i.id)
            from booking_items i where i.booking_id = b.id),
         case when has_role('admin', 'office', 'dock') then b.total_price end,
         case when has_role('admin', 'office', 'dock') then
           (select coalesce(sum(case p.kind when 'payment' then p.amount when 'refund' then -p.amount else 0 end), 0)
              from payments p where p.booking_id = b.id)
         end
    from bookings b
    join departures d on d.id = b.departure_id
    join customers c on c.id = b.customer_id
    left join hotels h on h.id = b.hotel_id
   where d.starts_at >= (p_day::timestamp at time zone local_tz())
     and d.starts_at < ((p_day + 1)::timestamp at time zone local_tz())
     and b.status <> 'cancelled'
     and is_active_staff()
   order by d.starts_at, b.departure_id, b.pickup_time nulls last, b.created_at;
$$;
revoke execute on function day_manifest(date) from public, anon;
grant execute on function day_manifest(date) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Check a group in (or undo it)
-- ---------------------------------------------------------------------------

create function set_check_in(p_booking_id bigint, p_checked_in boolean)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  st booking_status;
  result timestamptz;
begin
  if not is_active_staff() then
    raise exception 'new row violates row-level security policy';
  end if;
  select status into st from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if st = 'cancelled' then
    raise exception 'This booking is cancelled';
  end if;
  update bookings
     set checked_in_at = case when p_checked_in then coalesce(checked_in_at, now()) end,
         checked_in_by = case when p_checked_in then coalesce(checked_in_by, auth.uid()) end
   where id = p_booking_id
  returning checked_in_at into result;
  return result;
end;
$$;
revoke execute on function set_check_in(bigint, boolean) from public, anon;
grant execute on function set_check_in(bigint, boolean) to authenticated;
