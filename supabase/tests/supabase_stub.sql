-- The few Supabase pieces the migrations need, for testing on a plain
-- PostgreSQL database (on your computer or in GitHub Actions).
-- Never run this on the real Supabase project: it already has all of this.

-- Roles belong to the whole server, so they may already exist from an earlier run.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema extensions;
create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id uuid primary key,
  email text
);

-- Supabase reads the logged-in user from the request; the tests set it with
--   set local request.jwt.claim.sub = '<user id>';
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

-- Like Supabase: new tables, functions and sequences in public are open to
-- the API roles, and the security rules (RLS) decide what they can see.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
