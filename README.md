# Cabo Sailing booking platform

In-house booking system for Cabo Sailing, replacing Rezdy. Internal staff tool only.

- `PROGRESS.md` tracks what we have done and links to the platforms we use.
- `docs/setup.md` explains how to set up the database, the first login and Vercel.
- `docs/database.md` explains the database in plain language.
- `supabase/migrations/` holds the database definition (run the files in order).
- `src/` holds the staff dashboard (Next.js).

To run it on a computer: copy `.env.example` to `.env.local`, fill it in, then
`npm install` and `npm run dev`.
