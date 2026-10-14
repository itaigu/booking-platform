# Next steps (to continue tomorrow)

Where we are: step 1 is done. The staff dashboard (step 2) is built and waiting for you to set it up.

## 1. Update the database (2 minutes)

1. In Supabase, open **SQL Editor**, then **New query**.
2. Paste in all of the file [supabase/migrations/20261014010000_dashboard.sql](supabase/migrations/20261014010000_dashboard.sql).
3. Click **Run**. You should see "Success. No rows returned".

## 2. Create your login (2 minutes)

1. In Supabase, go to **Authentication**, then **Users**, then **Add user**, then **Create new user**.
2. Enter your email and a password.
3. Tick **Auto Confirm User** and click **Create user**.

## 3. Make yourself admin (1 minute)

In **SQL Editor**, open a **New query**, paste this in, and change the name and email to yours:

```sql
insert into staff (id, full_name, role, language)
select id, 'Itai', 'admin', 'es' from auth.users where email = 'your-email@example.com';
```

Click **Run**. It should say "1 row affected" or similar.

## 4. Merge the dashboard into GitHub (1 minute)

Open [pull request #2](https://github.com/itaigu/booking-platform/pull/2), click **Merge pull request**, then **Confirm merge**.

## 5. Put it online with Vercel (5 minutes)

1. In Vercel, click **Add New…**, then **Project**, and **Import** `booking-platform`.
2. Before deploying, open **Environment Variables** and add these three. You'll find them in Supabase under **Project Settings → API Keys**, plus the project URL under **Project Settings → Data API**.

   | Name | Where to find it in Supabase |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://….supabase.co`) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) |
   | `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`). Only paste this into Vercel. Never send it in chat. |

3. Click **Deploy** and wait for it to finish.
4. Open the link Vercel gives you and log in with the email and password from step 2.

## 6. Tell Claude "done"

Send the Vercel link in the project thread. Claude will then check everything works and help you add your boats, tours and schedules.

If anything shows a red error, send a screenshot.
