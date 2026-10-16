create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- move privileged bodies into the non-exposed schema
alter function public.submit_usdt_payment(text,text) set schema private;
alter function public.review_usdt_payment(uuid,boolean) set schema private;
alter function public.claim_first_admin() set schema private;
alter function public.admin_exists() set schema private;
alter function public.get_verification_badge(uuid) set schema private;
alter function public.lookup_member_by_nexus_id(text) set schema private;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.submit_usdt_payment(text,text), private.review_usdt_payment(uuid,boolean),
  private.claim_first_admin(), private.admin_exists(), private.get_verification_badge(uuid),
  private.lookup_member_by_nexus_id(text) to authenticated;

-- thin invoker wrappers keep the same API names
create function public.submit_usdt_payment(_tier text, _tx_reference text) returns uuid language sql security invoker set search_path = public as $$ select private.submit_usdt_payment(_tier, _tx_reference) $$;
create function public.review_usdt_payment(_purchase_id uuid, _approve boolean) returns void language sql security invoker set search_path = public as $$ select private.review_usdt_payment(_purchase_id, _approve) $$;
create function public.claim_first_admin() returns void language sql security invoker set search_path = public as $$ select private.claim_first_admin() $$;
create function public.admin_exists() returns boolean language sql stable security invoker set search_path = public as $$ select private.admin_exists() $$;
create function public.get_verification_badge(_user_id uuid) returns text language sql stable security invoker set search_path = public as $$ select private.get_verification_badge(_user_id) $$;
create function public.lookup_member_by_nexus_id(p_member_id text) returns table(id uuid, member_id text, first_name text, last_name text, full_name text, avatar_url text) language sql stable security invoker set search_path = public as $$ select * from private.lookup_member_by_nexus_id(p_member_id) $$;
revoke execute on function public.submit_usdt_payment(text,text), public.review_usdt_payment(uuid,boolean), public.claim_first_admin(), public.admin_exists(), public.get_verification_badge(uuid), public.lookup_member_by_nexus_id(text) from public, anon;
grant execute on function public.submit_usdt_payment(text,text), public.review_usdt_payment(uuid,boolean), public.claim_first_admin(), public.admin_exists(), public.get_verification_badge(uuid), public.lookup_member_by_nexus_id(text) to authenticated;

-- rate limiter is server-only
revoke execute on function public.consume_auth_email_code_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_auth_email_code_limit(text,integer,integer) to service_role;

-- server-only table: explicit deny policy documents intent
create policy "No client access" on public.auth_email_code_limits for all to authenticated, anon using (false) with check (false);

-- invoice numbers
create sequence if not exists public.invoice_number_seq start 1001;
alter table public.storage_purchases add column if not exists invoice_number bigint unique default nextval('public.invoice_number_seq');
grant usage on sequence public.invoice_number_seq to service_role;