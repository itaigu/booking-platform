-- Cabo Sailing booking platform: extra hours on tours, and a guest limit on private charters.
-- Paste this whole file into the Supabase SQL Editor and press "Run".

-- How many extra hours a tour can be extended by, and the price of each.
alter table products
  add column max_extra_hours int not null default 0 check (max_extra_hours between 0 and 12),
  add column extra_hour_price numeric(10, 2) check (extra_hour_price >= 0);

-- Private charters: max_guests (guests included + extra guests allowed) now
-- limits the booking too, never above what the boat holds.
create or replace function check_departure_capacity() returns trigger
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
  coalesce(s.guests, 0)::int as guests_booked,
  coalesce(s.bookings, 0)::int as bookings_count,
  case when p.kind = 'private' then (case when coalesce(s.bookings, 0) > 0 then 0 else least(coalesce(p.max_guests, b.max_guests), b.max_guests) end)
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
