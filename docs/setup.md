# Setting up the staff dashboard

Do these once, in order.

## 1. Update the database

Run every file in `supabase/migrations/`, in order, on the Supabase project.
Claude does this with the Supabase connector, so each one is recorded in
Supabase's migration history. GitHub is the only official copy of these files.

## 2. Create the first admin login

1. In Supabase, go to **Authentication → Users → Add user → Create new user**.
2. Enter your email and a password, tick **Auto Confirm User**, and click **Create user**.
3. In **SQL Editor → New query**, run this (with your own name and email):

```sql
insert into staff (id, full_name, role, language)
select id, 'Your Name', 'admin', 'es' from auth.users where email = 'you@example.com';
```

## 3. Put the dashboard online with Vercel

1. In Vercel, click **Add New… → Project** and import `booking-platform`.
2. Open **Environment Variables** and add these three. Copy them from Supabase
   (**Project Settings → API Keys**, and the project URL from **Project Settings → Data API**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (secret: only paste it into Vercel)
3. Click **Deploy**.

## 4. First things to set up in the dashboard

1. **Boats**: add each boat with its max guests.
2. **Tours**: add each tour, tick which boats can run it, and add ticket types
   (Adult, Child…) for shared tours.
3. **Staff**: add the rest of the team with their role.

## 5. Connect Stripe (payment links)

Start in **test mode** (the "Test mode" switch in Stripe), where no real money moves.

1. In Stripe, go to **Developers → API keys** and copy the **Secret key** (`sk_test_…`).
2. In Stripe, go to **Developers → Webhooks → Add endpoint**:
   - Endpoint URL: `https://booking-platform-sooty.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Click **Add endpoint**, then **Reveal** the **Signing secret** (`whsec_…`) and copy it.
3. In Vercel, open the project → **Settings → Environment Variables** and add:
   - `STRIPE_SECRET_KEY` = the secret key from step 1
   - `STRIPE_WEBHOOK_SECRET` = the signing secret from step 2
4. In Vercel, go to **Deployments**, open the menu (⋯) on the latest one and click **Redeploy**.

Only paste these keys into Vercel, never in chat. To go live later, do the same
steps with Stripe's live keys (`sk_live_…`) and a new live webhook.
