-- Payments: Stripe payment links and payments taken in person.
--   1. Payment links: staff create a Stripe link for a booking (deposit or the
--      rest) and send it to the customer. Stripe tells us when it is paid.
--   2. Payments can't be edited. Admin, office and dock record payments taken
--      in person; only an admin can delete one recorded by mistake. Stripe
--      payments are only written by the system.

-- ---------------------------------------------------------------------------
-- 1. Payment links
-- ---------------------------------------------------------------------------

create type payment_link_status as enum ('open', 'paid', 'cancelled');

create table payment_links (
  id bigint generated always as identity primary key,
  booking_id bigint not null references bookings (id),
  amount numeric(10, 2) not null check (amount > 0),
  stripe_link_id text not null unique,
  url text not null,
  status payment_link_status not null default 'open',
  created_by uuid references staff (id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((status = 'paid') = (paid_at is not null))
);
create index payment_links_booking_idx on payment_links (booking_id);
create index payment_links_created_by_idx on payment_links (created_by);

alter table payment_links enable row level security;
create policy staff_read on payment_links for select to authenticated
  using (has_role('admin', 'office', 'dock'));
create policy office_insert on payment_links for insert to authenticated
  with check (has_role('admin', 'office') and status = 'open');
-- Staff can only cancel an open link; Stripe marks them paid.
create policy office_cancel on payment_links for update to authenticated
  using (has_role('admin', 'office') and status = 'open')
  with check (has_role('admin', 'office') and status = 'cancelled');
revoke all on payment_links from anon;
grant select, insert, update on payment_links to authenticated;

create trigger payment_links_log after insert or update on payment_links
  for each row execute function log_change();

-- ---------------------------------------------------------------------------
-- 2. Payments
-- ---------------------------------------------------------------------------

-- The same Stripe payment is never recorded twice (Stripe can send it again).
create unique index payments_stripe_unique on payments (stripe_payment_id)
  where stripe_payment_id is not null;

-- One policy for writing (changed in place): new rows must follow the check,
-- and only an admin can delete, never a Stripe payment. Nobody can update.
alter policy office_write on payments
  using (has_role('admin') and method <> 'stripe')
  with check (has_role('admin', 'office', 'dock') and method <> 'stripe'
              and stripe_payment_id is null and recorded_by = auth.uid());
alter policy office_write on payments rename to staff_write;
revoke update on payments from authenticated;

-- Called by the Stripe webhook (with the secret key) when a link is paid.
-- Records the payment and marks the link paid. Safe to call more than once.
-- Returns false when the link is not ours.
create function record_stripe_payment(p_stripe_link_id text, p_stripe_payment_id text, p_amount numeric)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  link payment_links;
begin
  select * into link from payment_links where stripe_link_id = p_stripe_link_id for update;
  if not found then
    return false;
  end if;
  insert into payments (booking_id, kind, method, amount, stripe_payment_id, note)
  values (link.booking_id, 'payment', 'stripe', p_amount, p_stripe_payment_id, 'Stripe')
  on conflict (stripe_payment_id) where stripe_payment_id is not null do nothing;
  update payment_links set status = 'paid', paid_at = coalesce(paid_at, now())
   where id = link.id and status <> 'paid';
  return true;
end;
$$;
revoke execute on function record_stripe_payment(text, text, numeric) from public, anon, authenticated;
grant execute on function record_stripe_payment(text, text, numeric) to service_role;
