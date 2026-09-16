-- HPAIR delegate application — Supabase schema
--
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Then replace ADMIN_EMAIL_HERE below with the email you will sign in as.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
--
-- The answers are stored as a single `jsonb` column rather than one column per
-- field. The form's shape is still changing, and a jsonb document means adding a
-- question is a front-end change rather than a migration. The trade-off is that
-- Postgres cannot type-check the contents — which is why the insert policy below
-- constrains the shape, and why the Yup schema remains the real gate.
--
-- The three generated columns are the exception. They are the values the admin
-- list filters and counts on, so they are lifted out of the jsonb and stored as
-- real columns: that lets the counts be done by the database with `count`
-- instead of fetching every row into the browser to count them in JavaScript.
-- They are `stored`, so they cost write time once rather than read time forever,
-- and they cannot drift from the jsonb because Postgres derives them.

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  submitted_at  timestamptz not null default now(),
  answers       jsonb not null,
  attachment    jsonb,

  country text generated always as (answers ->> 'country') stored,

  needs_visa_letter boolean generated always as (
    (answers ->> 'needsVisa') = 'yes' and (answers ->> 'needsVisaLetter') = 'yes'
  ) stored,

  needs_financial_aid boolean generated always as (
    (answers ->> 'needsFinancialAid') = 'yes'
  ) stored
);

-- Newest-first is the only order the admin list uses.
create index if not exists submissions_submitted_at_idx
  on public.submissions (submitted_at desc);

-- ---------------------------------------------------------------------------
-- Table privileges (GRANT) -- the layer BEFORE row level security
-- ---------------------------------------------------------------------------
--
-- These are easy to forget and produce a confusing error when missing:
-- `42501 permission denied for table submissions`, which looks like an RLS
-- problem but is not. Postgres checks two independent things, in this order:
--
--   1. GRANT  -- may this role touch the table at all?
--   2. POLICY -- which rows may it see or write?
--
-- A request that fails step 1 never reaches the policies. Supabase's dashboard
-- normally applies default privileges for tables created through the Table
-- Editor, but a table created in the SQL Editor may not receive them, so they
-- are granted explicitly here.
--
-- Least privilege, deliberately:
--
--   anon          INSERT only. A visitor submits an application; they have no
--                 reason to read the table, so they cannot -- and this is
--                 refused at the GRANT layer, before RLS is even consulted.
--                 Two independent layers have to be wrong for data to leak.
--
--   authenticated INSERT and SELECT. The admin needs to read, and *which* rows
--                 they may read is then decided by the policy below.
--
-- Note what is NOT granted anywhere: UPDATE and DELETE. An application cannot be
-- modified or removed from the browser at all, by anyone.

grant usage on schema public to anon, authenticated;

grant insert on public.submissions to anon;
grant insert, select on public.submissions to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
--
-- This is the whole security model. The anon key ships in the JavaScript bundle
-- and is meant to — it identifies the project, it does not authorise anything.
-- What stops one applicant reading another's submission is that Postgres refuses
-- the row, not that the front-end declines to ask for it.
--
-- This is precisely what the starter repo got wrong: it had credentials AND a
-- login, and still exposed every applicant's data, because the narrowing to one
-- user happened in the browser. A filter in the client is presentation. A policy
-- here is enforcement.

alter table public.submissions enable row level security;

-- Anyone may apply, including signed-out visitors.
--
-- `with check` constrains what an anonymous writer may insert: a plausible
-- reference, an object for answers, and a size ceiling. Without the ceiling the
-- endpoint is an open invitation to fill the free tier with megabytes of text.
drop policy if exists "anyone may submit an application" on public.submissions;
create policy "anyone may submit an application"
  on public.submissions
  for insert
  to anon, authenticated
  with check (
    length(reference) between 5 and 64
    and jsonb_typeof(answers) = 'object'
    and length(answers::text) < 20000
    and (attachment is null or length(attachment::text) < 2000)
  );

-- Only the admin may read. Everyone else gets zero rows — not an error, which is
-- the correct behaviour: a policy should not confirm that rows exist.
drop policy if exists "only the admin may read submissions" on public.submissions;
create policy "only the admin may read submissions"
  on public.submissions
  for select
  to authenticated
  using (auth.jwt() ->> 'email' = 'ADMIN_EMAIL_HERE');

-- No update or delete policies exist, so both are denied to everyone. An
-- application record should not be editable from the browser at all.

-- ---------------------------------------------------------------------------
-- Check your work
-- ---------------------------------------------------------------------------
-- Run this after the above. It should return one row per policy (2), and
-- rowsecurity = true. If RLS is not enabled, the table is world-readable.
--
--   -- RLS must be on, or the anon key alone can read the table:
--   select relname, relrowsecurity from pg_class where relname = 'submissions';
--
--   -- Two policies expected:
--   select policyname, cmd, roles from pg_policies where tablename = 'submissions';
--
--   -- Grants: anon should have INSERT only; authenticated INSERT and SELECT.
--   -- Neither should have UPDATE or DELETE.
--   select grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_name = 'submissions' and grantee in ('anon', 'authenticated')
--    order by grantee, privilege_type;
