-- Tests for the rules the database enforces on its own.
-- Run with supabase/tests/run.sh on an empty PostgreSQL database
-- (never on the real Supabase project). Stops at the first failure.

\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
set client_min_messages = notice;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create schema tests;
grant usage on schema tests to anon, authenticated;

-- Fails unless the condition holds.
create function tests.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then
    raise exception 'FAILED: %', what;
  end if;
  raise notice 'ok - %', what;
end;
$$;

-- Fails unless the SQL raises an error matching the pattern.
create function tests.fails(sql text, pattern text, what text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm !~* pattern then
      raise exception 'FAILED: % (expected an error like "%", got "%")', what, pattern, sqlerrm;
    end if;
    raise notice 'ok - %', what;
    return;
  end;
  raise exception 'FAILED: % (expected an error like "%", but it worked)', what, pattern;
end;
$$;

-- Log in as a staff member (or nobody).
create function tests.login(who text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', case who
    when 'admin' then '00000000-0000-0000-0000-00000000000a'
    when 'office' then '00000000-0000-0000-0000-00000000000b'
    when 'dock' then '00000000-0000-0000-0000-00000000000d'
    when 'crew' then '00000000-0000-0000-0000-00000000000c'
    else '' end, false);
$$;

-- A trip's local start or end time, e.g. '2030-01-10 09:00'.
create function tests.local(t timestamptz) returns text language sql as $$
  select to_char(t at time zone 'America/Mazatlan', 'YYYY-MM-DD HH24:MI');
$$;

-- A new private trip for a customer; returns the customer it was booked for.
create function tests.trip_for(customer jsonb, day int) returns bigint language plpgsql as $$
declare
  b bigint;
begin
  b := create_trip_booking(
    jsonb_build_object('name', 'Trip', 'kind', 'private', 'boat_id', 2,
      'starts_at', format('2030-02-%sT09:00:00-07:00', lpad(day::text, 2, '0')), 'duration_minutes', 60,
      'base_guests', 2, 'base_price', 300),
    customer, 'phone');
  return (select customer_id from bookings where id = b);
end;
$$;

-- ---------------------------------------------------------------------------
-- Test data (as the database owner)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test'),
  ('00000000-0000-0000-0000-00000000000b', 'office@test'),
  ('00000000-0000-0000-0000-00000000000d', 'dock@test'),
  ('00000000-0000-0000-0000-00000000000c', 'crew@test');
insert into staff (id, full_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'Office', 'office'),
  ('00000000-0000-0000-0000-00000000000d', 'Dock', 'dock'),
  ('00000000-0000-0000-0000-00000000000c', 'Crew', 'crew');

-- boat 1 holds 10, boat 2 holds 6
insert into boats (name, max_guests) overriding system value
values ('Big', 10), ('Small', 6);

set role authenticated;

-- ---------------------------------------------------------------------------
-- Private one-off trip: create, change guests and extra hours, move it
-- ---------------------------------------------------------------------------

select tests.login('office');

select create_trip_booking(
  jsonb_build_object('name', 'Snorkel Perez', 'kind', 'private', 'boat_id', 1,
    'starts_at', '2030-01-10T09:00:00-07:00', 'duration_minutes', 180, 'buffer_minutes', 30,
    'base_guests', 4, 'base_price', 1000, 'extra_guests', 2, 'extra_guest_price', 100, 'extra_hours', 0),
  '{"full_name": "Ana Perez", "email": "ana@example.com", "phone": "+52 624 111 2222"}', 'phone') as b1 \gset
select departure_id as d1, customer_id as c1 from bookings where id = :b1 \gset

select tests.ok((select total_price = 1200 and guests = 6 from bookings where id = :b1), 'private trip: 4 included + 2 extra = 1200');

select update_booking_guests(:b1, 8);
select tests.ok((select total_price = 1400 and guests = 8 from bookings where id = :b1), 'change guests to 8: total 1400');
select tests.ok((select capacity = 8 from departure_availability where id = :d1), 'trip capacity follows the booking');
select tests.fails(format('select update_booking_guests(%s, 11)', :b1), 'holds at most 10', 'more guests than the boat holds');

select update_booking_guests(:b1, 8, 1, null, 150);
select tests.ok((select total_price = 1550 from bookings where id = :b1), 'add 1 extra hour at 150: total 1550');
select tests.ok((select tests.local(ends_at) = '2030-01-10 13:00' from departures where id = :d1), 'extra hour makes the trip end an hour later');
select tests.ok((select count(*) = 3 from booking_items where booking_id = :b1), 'items worked out again: charter, extra guests, extra hour');

select update_booking_guests(:b1, 8, 1, null, null, 1500);
select tests.ok((select total_price = 1500 from bookings where id = :b1), 'special price replaces the worked-out total');

select update_departure(:d1, 1, '2030-01-11T10:00:00-07:00', 180, 30, 'Snorkel familia Perez');
select tests.ok((select tests.local(starts_at) = '2030-01-11 10:00' and tests.local(ends_at) = '2030-01-11 14:00'
                   from departures where id = :d1), 'move the trip to another day and time (extra hour kept)');
select tests.ok((select name_es = 'Snorkel familia Perez' from products p join departures d on d.product_id = p.id where d.id = :d1),
                'rename a one-off trip');

select tests.fails(
  $$select create_trip_booking(jsonb_build_object('name', 'Other', 'kind', 'private', 'boat_id', 1,
      'starts_at', '2030-01-11T12:00:00-07:00', 'duration_minutes', 120, 'base_guests', 2, 'base_price', 500),
      '{"full_name": "Someone"}', 'phone')$$,
  'exclusion', 'no second trip on a busy boat');
select tests.fails(format($$select update_departure(%s, 2, '2030-01-11T10:00:00-07:00', 180, 30)$$, :d1),
  'Too many guests', 'no moving 8 guests to a boat that holds 6');

-- ---------------------------------------------------------------------------
-- Cancelling a one-off booking frees the boat; reactivating brings the trip back
-- ---------------------------------------------------------------------------

update bookings set status = 'cancelled' where id = :b1;
select tests.ok((select status = 'cancelled' from departures where id = :d1), 'cancelling the booking cancels its one-off trip');

select create_trip_booking(jsonb_build_object('name', 'Other', 'kind', 'private', 'boat_id', 1,
    'starts_at', '2030-01-11T12:00:00-07:00', 'duration_minutes', 120, 'base_guests', 2, 'base_price', 500),
    '{"full_name": "Someone"}', 'phone') as b2 \gset
select tests.ok(true, 'the boat is free again for another trip');

select tests.fails(format($$update bookings set status = 'confirmed' where id = %s$$, :b1),
  'exclusion', 'no reactivating while the boat is now busy');
update bookings set status = 'cancelled' where id = :b2;
update bookings set status = 'confirmed' where id = :b1;
select tests.ok((select status = 'scheduled' from departures where id = :d1), 'reactivating brings the one-off trip back');

-- ---------------------------------------------------------------------------
-- History of changes
-- ---------------------------------------------------------------------------

update bookings set total_price = 1450 where id = :b1;
select tests.ok((select count(*) = 1 from change_log
                  where booking_id = :b1 and changes -> 'total_price' = '[1500.00, 1450.00]'::jsonb
                    and changed_by = '00000000-0000-0000-0000-00000000000b'),
                'total change saved with old value, new value and who');
select tests.ok((select count(*) >= 2 from change_log where table_name = 'departures' and departure_id = :d1),
                'trip changes are in the history');
select tests.fails('delete from change_log', 'permission denied', 'history cannot be deleted');
select tests.fails('update change_log set changes = ''{}''', 'permission denied', 'history cannot be edited');

-- ---------------------------------------------------------------------------
-- Shared one-off trip: no overbooking
-- ---------------------------------------------------------------------------

select create_trip_booking(
  jsonb_build_object('name', 'Sunset shared', 'kind', 'shared', 'boat_id', 1,
    'starts_at', '2030-01-12T17:00:00-07:00', 'duration_minutes', 120,
    'guests', 5, 'guest_price', 50, 'max_guests', 8, 'min_guests', 2),
  '{"full_name": "Bob"}', 'whatsapp') as b3 \gset
select departure_id as d3 from bookings where id = :b3 \gset
select id as tt3 from ticket_types where product_id = (select product_id from departures where id = :d3) \gset

select tests.fails(format($$select create_booking(%s, '{"full_name": "Carl"}', 'phone', '[{"ticket_type_id": %s, "quantity": 4}]', null)$$, :d3, :tt3),
  'Not enough space', 'no selling 4 seats when 3 are left');
select create_booking(:d3, '{"full_name": "Carl"}', 'phone', format('[{"ticket_type_id": %s, "quantity": 3}]', :tt3)::jsonb, null) as b4 \gset
select tests.ok((select total_price = 150 from bookings where id = :b4), 'last 3 seats sold at 50 each');
select tests.fails(format('select update_booking_guests(%s, 4)', :b4), 'Not enough space', 'no adding a guest to a full trip');

-- ---------------------------------------------------------------------------
-- Returning customers
-- ---------------------------------------------------------------------------

select tests.ok(tests.trip_for('{"full_name": "A. Perez", "email": "ANA@example.com"}', 1) = :c1,
                'same email (any case) reuses the customer');
select tests.ok(tests.trip_for('{"full_name": "ana perez", "phone": "6241112222"}', 2) <> :c1,
                'same phone but a different number of digits is a new customer');
select tests.ok(tests.trip_for('{"full_name": "ana perez", "phone": "(52) 624-111-2222"}', 3) = :c1,
                'same name and phone (any format) reuses the customer');
select tests.ok(tests.trip_for('{"full_name": "Luis Perez", "phone": "+52 624 111 2222"}', 4) <> :c1,
                'same phone with another name is a new customer');

-- ---------------------------------------------------------------------------
-- Maintenance blocks and capacity changes (admin)
-- ---------------------------------------------------------------------------

select tests.login('admin');

select tests.fails($$insert into boat_blocks (boat_id, starts_at, ends_at, reason)
                     values (1, '2030-01-12T16:00:00-07:00', '2030-01-12T20:00:00-07:00', 'Engine')$$,
  'There are 1 trips', 'no block on top of a trip with guests');
insert into boat_blocks (boat_id, starts_at, ends_at, reason)
values (1, '2030-03-01T00:00:00-07:00', '2030-03-02T00:00:00-07:00', 'Engine');
select tests.fails(
  $$select create_trip_booking(jsonb_build_object('name', 'X', 'kind', 'private', 'boat_id', 1,
      'starts_at', '2030-03-01T09:00:00-07:00', 'duration_minutes', 120, 'base_guests', 2, 'base_price', 500),
      '{"full_name": "Someone"}', 'phone')$$,
  'blocked', 'no new trip on a blocked boat');
select tests.fails(format($$select update_departure(%s, 1, '2030-03-01T10:00:00-07:00', 120, 0)$$, :d3),
  'blocked', 'no moving a trip onto a blocked boat');

select tests.fails('update boats set max_guests = 7 where id = 1', 'Too many guests',
  'no shrinking a boat below the guests already booked');

-- a tour template with a trip from Schedules
insert into products (name_en, name_es, kind, duration_minutes, max_guests)
values ('Snorkel', 'Snorkel', 'shared', 120, 10) returning id as p5 \gset
insert into ticket_types (product_id, name_en, name_es, price) values (:p5, 'Per person', 'Por persona', 80) returning id as tt5 \gset
insert into product_boats values (:p5, 2);
insert into schedules (product_id, boat_id, weekdays, start_time, valid_from)
values (:p5, 2, '{0,1,2,3,4,5,6}', '08:00', '2030-04-01') returning id as s5 \gset
select tests.ok(generate_departures(:s5, '2030-04-01', '2030-04-03') = 3, 'schedule creates 3 trips');
select tests.ok(generate_departures(:s5, '2030-04-01', '2030-04-03') = 0, 'and none twice');
select id as d5 from departures where schedule_id = :s5 order by starts_at limit 1 \gset
select id as d6 from departures where schedule_id = :s5 order by starts_at offset 1 limit 1 \gset

select tests.login('office');
select create_booking(:d5, '{"full_name": "Dana"}', 'walk_in', format('[{"ticket_type_id": %s, "quantity": 5}]', :tt5)::jsonb, null) as b5 \gset
select tests.ok((select capacity = 6 from departure_availability where id = :d5), 'template trip: capacity is the smaller of tour and boat');

select tests.login('admin');
select tests.fails(format('update products set max_guests = 4 where id = %s', :p5), 'Too many guests',
  'no shrinking a tour below the guests already booked');

-- ---------------------------------------------------------------------------
-- Hotel bookings and commissions
-- ---------------------------------------------------------------------------

insert into hotels (name, default_commission_pct) values ('Hotel One', 10) returning id as h1 \gset
insert into hotels (name, default_commission_pct) values ('Hotel Two', 12) returning id as h2 \gset
insert into hotels (name, default_commission_pct, active) values ('Old Hotel', 5, false) returning id as h0 \gset
select tests.login('office');

insert into bookings (departure_id, customer_id, channel, hotel_id, hotel_code, guests, total_price)
values (:d6, :c1, 'hotel', :h1, 'ABC-1', 1, 80);
select tests.fails(format($$insert into bookings (departure_id, customer_id, channel, hotel_id, hotel_code, guests, total_price)
                            values (%s, %s, 'hotel', %s, 'abc-1', 1, 80)$$, :d6, :c1, :h1),
  'duplicate key', 'one hotel code, one booking');
select tests.ok((select c.commission_pct = 10 and c.commission_amount = 8 and c.status = 'owed'
                   from commissions c join bookings b on b.id = c.booking_id where b.hotel_code = 'ABC-1'),
                'every hotel booking gets its commission (10% of 80)');

select create_hotel_booking(jsonb_build_object('hotel_id', :h1, 'code', 'ABC-2'), '{"full_name": "Eve"}',
  :d6, null, format('[{"ticket_type_id": %s, "quantity": 2}]', :tt5)::jsonb) as hb1 \gset
select tests.ok((select channel = 'hotel' and hotel_code = 'ABC-2' and total_price = 160 from bookings where id = :hb1),
                'hotel booking on a trip already on the calendar');
select tests.ok((select commission_amount = 16 from commissions where booking_id = :hb1), 'commission at the hotel default: 10% of 160');
select tests.fails(format($$select create_hotel_booking(jsonb_build_object('hotel_id', %s, 'code', ' abc-2 '), '{"full_name": "Eve"}',
                            %s, null, '[{"ticket_type_id": %s, "quantity": 1}]')$$, :h1, :d6, :tt5),
  'already used \(booking CS-', 'a hotel code is used only once, whatever the case or spaces');
select tests.fails(format($$select create_hotel_booking(jsonb_build_object('hotel_id', %s, 'code', 'X1'), '{"full_name": "Eve"}',
                            %s, null, '[{"ticket_type_id": %s, "quantity": 1}]')$$, :h0, :d6, :tt5),
  'Choose the hotel', 'no bookings for an inactive hotel');
select tests.fails(format($$select create_hotel_booking(jsonb_build_object('hotel_id', %s, 'code', '  '), '{"full_name": "Eve"}',
                            %s, null, '[{"ticket_type_id": %s, "quantity": 1}]')$$, :h1, :d6, :tt5),
  'Enter the hotel code', 'a hotel booking needs the code');
select tests.fails(format($$select create_booking(%s, '{"full_name": "Eve"}', 'hotel', '[{"ticket_type_id": %s, "quantity": 1}]', null)$$, :d6, :tt5),
  'Choose the hotel', 'the other booking forms cannot make hotel bookings');

select create_hotel_booking(jsonb_build_object('hotel_id', :h1, 'code', 'ZZ-9', 'commission_pct', '15'), '{"full_name": "Fay"}', null,
  jsonb_build_object('name', 'Hotel charter', 'kind', 'private', 'boat_id', 2,
    'starts_at', '2030-02-20T09:00:00-07:00', 'duration_minutes', 120, 'base_guests', 4, 'base_price', 900)) as hb2 \gset
select tests.ok((select commission_pct = 15 and commission_amount = 135 from commissions where booking_id = :hb2),
                'new trip from a hotel, with its own 15%');
select create_hotel_booking(jsonb_build_object('hotel_id', :h2, 'code', 'zz-9'), '{"full_name": "Gus"}',
  :d6, null, format('[{"ticket_type_id": %s, "quantity": 1}]', :tt5)::jsonb) as hb4 \gset
select tests.ok(true, 'another hotel can use the same code');

update bookings set total_price = 1000 where id = :hb2;
select tests.ok((select commission_amount = 150 from commissions where booking_id = :hb2), 'commission follows a new total');
select update_booking_guests(:hb2, 5, null, 50);
select tests.ok((select commission_amount = 142.50 from commissions where booking_id = :hb2), 'commission follows a change of guests');
update commissions set commission_pct = 20 where booking_id = :hb2;
select tests.ok((select commission_amount = 190 from commissions where booking_id = :hb2), 'a new % works the amount out again');
update commissions set commission_amount = 1 where booking_id = :hb2;
select tests.ok((select commission_amount = 190 from commissions where booking_id = :hb2), 'the amount cannot be typed by hand');

update bookings set status = 'cancelled' where id = :hb2;
select tests.ok((select status = 'cancelled' from commissions where booking_id = :hb2), 'cancelling the booking cancels its commission');
update bookings set status = 'confirmed' where id = :hb2;
select tests.ok((select status = 'owed' and commission_amount = 190 from commissions where booking_id = :hb2),
                'reactivating the booking brings its commission back');
update bookings set status = 'no_show' where id = :hb2;
select tests.ok((select status = 'owed' from commissions where booking_id = :hb2), 'a no-show keeps its commission');

-- a trip that already happened
select create_hotel_booking(jsonb_build_object('hotel_id', :h1, 'code', 'OLD-1'), '{"full_name": "Hal"}', null,
  jsonb_build_object('name', 'Past charter', 'kind', 'private', 'boat_id', 1,
    'starts_at', '2020-03-10T09:00:00-07:00', 'duration_minutes', 120, 'base_guests', 2, 'base_price', 500)) as hb3 \gset
select tests.ok((select trip_day = '2020-03-10' and commission_amount = 50 from commission_lines where booking_id = :hb3),
                'report line with the trip day in Cabo time');
select tests.ok(pay_hotel_commissions(:h1, '2020-03-01', '2020-04-05') = 1, 'mark a hotel''s month as paid');
select tests.ok((select status = 'paid' and paid_at = '2020-04-05' from commissions where booking_id = :hb3), 'paid, with the payment date');
select tests.fails(format('update commissions set commission_pct = 50 where booking_id = %s', :hb3), 'already paid',
  'a paid commission cannot change');
update bookings set total_price = 400 where id = :hb3;
select tests.ok((select commission_amount = 50 from commissions where booking_id = :hb3), 'a paid commission keeps its amount');
select tests.fails(format($$select pay_hotel_commissions(%s, '2020-03-01', '2020-04-05')$$, :h1), 'Nothing to mark',
  'no paying the same month twice');
select tests.fails(format($$select pay_hotel_commissions(%s, '2030-02-01', '2030-03-01')$$, :h1), 'Nothing to mark',
  'trips that have not happened yet are not paid');
select tests.fails(format($$select undo_hotel_commission_payment(%s, '2020-03-01')$$, :h1), 'row-level security',
  'office cannot undo a payment');
select tests.login('admin');
select tests.ok(undo_hotel_commission_payment(:h1, '2020-03-01') = 1, 'admin can undo a payment');
select tests.ok((select status = 'owed' and paid_at is null and commission_amount = 40 from commissions where booking_id = :hb3),
                'undone: owed again, from the new total');
select tests.login('office');

-- ---------------------------------------------------------------------------
-- Who sees what
-- ---------------------------------------------------------------------------

select tests.login('crew');
select tests.ok((select count(*) = 0 from bookings), 'crew: no direct access to bookings');
select tests.ok((select count(*) = 0 from customers), 'crew: no direct access to customers');
select tests.ok((select count(*) = 0 from payments), 'crew: no access to payments');
select tests.ok((select count(*) = 0 from commission_lines), 'crew: no access to commissions');
select tests.ok((select guests_booked = 8 from departure_availability where id = :d1), 'crew: still sees seats booked');
select tests.ok((select count(*) = 1 and bool_and(total_price is null) and bool_and(full_name = 'Ana Perez')
                   from trip_manifest(:d1)), 'crew: guest list without prices');
select tests.fails(format($$select update_departure(%s, 1, '2030-01-11T11:00:00-07:00', 180, 30)$$, :d1),
  'row-level security', 'crew: cannot move a trip');
select tests.fails(format('select cancel_departure(%s)', :d1), 'row-level security', 'crew: cannot cancel a trip');

select tests.login('dock');
select tests.ok((select count(*) > 0 from bookings), 'dock: sees bookings');
select tests.ok((select bool_and(total_price is not null) from trip_manifest(:d1)), 'dock: guest list with prices');
select tests.ok((select count(*) = 0 from change_log), 'dock: no access to the history');
select tests.ok((select count(*) = 0 from commission_lines), 'dock: no access to commissions');
select tests.fails(format('select update_booking_guests(%s, 7)', :b1), 'row-level security', 'dock: cannot change bookings');

select tests.login('');
reset role;
set role anon;
select tests.fails('select is_admin()', 'permission denied', 'not logged in: no access to the role checks');
select tests.ok((select count(*) = 0 from bookings) and (select count(*) = 0 from customers), 'not logged in: sees no bookings or customers');
reset role;
set role authenticated;

-- ---------------------------------------------------------------------------
-- Cancel a whole trip for bad weather
-- ---------------------------------------------------------------------------

select tests.login('office');
select tests.ok(cancel_departure(:d3, true) = 2, 'bad weather: both bookings cancelled');
select tests.ok((select status = 'weather_cancelled' from departures where id = :d3), 'bad weather: trip marked as weather');
select tests.ok((select bool_and(status = 'cancelled' and cancelled_at is not null) from bookings where departure_id = :d3),
                'bad weather: every booking cancelled with its date');
select tests.fails(format('select cancel_departure(%s)', :d3), 'already cancelled', 'no cancelling twice');

reset role;
\o
\echo
\echo 'All database tests passed.'
