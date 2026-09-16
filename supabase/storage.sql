-- HPAIR delegate application — CV storage
--
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Replace ADMIN_EMAIL_HERE with the email you sign in as — the same one used in
-- schema.sql. A mismatch means the read policy matches nobody and the admin
-- cannot open any CV.

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------
--
-- `public => false`. A public bucket serves every object at a guessable URL with
-- no authentication at all, which for a bucket full of CVs -- names, addresses,
-- employment history -- would be the same class of mistake as the starter repo's
-- client-side filtering. Private means every read needs a signed, expiring URL.
--
-- The size and MIME limits mirror the Yup schema deliberately. The client-side
-- rule exists so the user gets a useful error before uploading 40 MB; this one
-- exists because the client cannot be trusted. The same constraint belongs in
-- both places, for different reasons.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs',
  'cvs',
  false,
  5242880, -- 5 MB, matching CV_MAX_BYTES in src/validation/schemas.js
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects
-- ---------------------------------------------------------------------------
--
-- storage.objects already has RLS enabled by Supabase, and anon/authenticated
-- already hold the table grants -- so unlike public.submissions, only policies
-- are needed here.

-- An applicant uploads their own CV while signed out. They may write into this
-- bucket and nothing else.
drop policy if exists "anyone may upload a cv" on storage.objects;
create policy "anyone may upload a cv"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'cvs');

-- Only the admin may read. Note this covers signed-URL creation too: Supabase
-- issues a signed URL only if the requester could have read the object, so an
-- applicant cannot mint a link to somebody else's CV -- or to their own.
drop policy if exists "only the admin may read cvs" on storage.objects;
create policy "only the admin may read cvs"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'cvs' and auth.jwt() ->> 'email' = 'ADMIN_EMAIL_HERE');

-- No update or delete policy: an uploaded CV cannot be replaced or removed from
-- the browser. Combined with `upsert: false` on the client, a submission's file
-- is write-once.

-- ---------------------------------------------------------------------------
-- Check your work
-- ---------------------------------------------------------------------------
--   select id, public, file_size_limit from storage.buckets where id = 'cvs';
--   -- public must be false.
--
--   select policyname, cmd, roles from pg_policies
--    where schemaname = 'storage' and tablename = 'objects';
