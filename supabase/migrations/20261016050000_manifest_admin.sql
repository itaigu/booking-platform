-- Cabo Sailing booking platform: the admin view of the manifest, and the crew of each trip.
--   1. A free-text crew field on every trip (captain and crew names).
--   2. day_manifest() also returns the agent reference (OTA reference or hotel
--      code), the coupon code and who made the booking, for the admin view.
--      Its columns change, so it is dropped and created again.
-- Needs the earlier migrations to have run first.

alter table departures add column crew text;

drop function day_manifest(date);

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
  paid numeric,
  ota_reference text,
  hotel_code text,
  promo_code text,
  created_by_name text
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
         end,
         b.ota_reference, b.hotel_code, pc.code, st.full_name
    from bookings b
    join departures d on d.id = b.departure_id
    join customers c on c.id = b.customer_id
    left join hotels h on h.id = b.hotel_id
    left join promo_codes pc on pc.id = b.promo_code_id
    left join staff st on st.id = b.created_by
   where d.starts_at >= (p_day::timestamp at time zone local_tz())
     and d.starts_at < ((p_day + 1)::timestamp at time zone local_tz())
     and b.status <> 'cancelled'
     and is_active_staff()
   order by d.starts_at, b.departure_id, b.pickup_time nulls last, b.created_at;
$$;
revoke execute on function day_manifest(date) from public, anon;
grant execute on function day_manifest(date) to authenticated;
