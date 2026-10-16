-- Cabo Sailing booking platform: a new booking keeps the name that was typed.
--   Before, a booking whose email matched an earlier customer was saved under
--   that customer, with the earlier customer's name. Now an earlier customer is
--   reused only when the name matches too (with the same email or phone);
--   otherwise a new customer is created.
-- Needs the earlier migrations to have run first.

create or replace function insert_booking(
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

    -- the same customer only when the name matches too, and the email or the phone
    select id into cust_id from customers
     where c_email is not null and lower(email) = lower(c_email)
       and lower(trim(full_name)) = lower(c_name)
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
