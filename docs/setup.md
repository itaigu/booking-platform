# Setting up the staff dashboard

Do these once, in order.

## 1. Update the database

In Supabase, open **SQL Editor → New query**, paste the whole of
`supabase/migrations/20261014010000_dashboard.sql` and click **Run**.

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
3. **Schedules**: add the regular times, then click **Create trips** to fill the calendar.
4. **Staff**: add the rest of the team with their role.
