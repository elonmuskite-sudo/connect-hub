-- Nexus Chat schema for your own Supabase project.
-- Paste into Supabase -> SQL Editor on a fresh project and run once.

insert into storage.buckets (id, name, public) values ('chat-files','chat-files', false), ('identity-docs','identity-docs', false) on conflict do nothing;

-- from 20261012105742_7f3801e7-d165-4bbd-a733-0f29089dd2ad.sql
create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role public.app_role not null, created_at timestamptz not null default now(), unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "Users see own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.update_updated_at_column() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;

create table public.user_storage_quotas (user_id uuid primary key, quota_bytes bigint not null default 5368709120, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select on public.user_storage_quotas to authenticated; grant all on public.user_storage_quotas to service_role;
alter table public.user_storage_quotas enable row level security;
create policy "Own quota" on public.user_storage_quotas for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create trigger trg_quota_updated before update on public.user_storage_quotas for each row execute function public.update_updated_at_column();

create table public.storage_purchases (id uuid primary key default gen_random_uuid(), user_id uuid not null, tier text not null, added_bytes bigint not null, amount_cents integer not null, currency text not null default 'usd', status text not null default 'pending', checkout_session_id text unique, receipt_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select on public.storage_purchases to authenticated; grant all on public.storage_purchases to service_role;
alter table public.storage_purchases enable row level security;
create policy "Own purchases" on public.storage_purchases for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create trigger trg_purchases_updated before update on public.storage_purchases for each row execute function public.update_updated_at_column();

create table public.identity_verifications (id uuid primary key default gen_random_uuid(), user_id uuid not null unique, status text not null default 'pending', match_score numeric, selfie_path text not null, id_document_path text not null, reviewer_note text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select, insert, update on public.identity_verifications to authenticated; grant all on public.identity_verifications to service_role;
alter table public.identity_verifications enable row level security;
create policy "Own or admin read" on public.identity_verifications for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Submit own pending" on public.identity_verifications for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null);
create policy "Resubmit own after rejection" on public.identity_verifications for update to authenticated using (user_id = auth.uid() and status = 'rejected') with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null);
create policy "Admins review" on public.identity_verifications for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger trg_idv_updated before update on public.identity_verifications for each row execute function public.update_updated_at_column();

create table public.storage_files (id uuid primary key default gen_random_uuid(), user_id uuid not null, chat_id text, file_name text not null, file_type text not null, mime_type text, size_bytes bigint not null default 0, duration_seconds numeric, storage_path text not null, created_at timestamptz not null default now());
grant select, insert, delete on public.storage_files to authenticated; grant all on public.storage_files to service_role;
alter table public.storage_files enable row level security;
create policy "Own files" on public.storage_files for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.get_verification_badge(_user_id uuid) returns text language sql stable security definer set search_path = public as $$
  select case
    when exists(select 1 from public.identity_verifications where user_id=_user_id and status='approved') then 'authenticated'
    when exists(select 1 from auth.users where id=_user_id and email_confirmed_at is not null) then 'verified'
    else 'none' end $$;
grant execute on function public.get_verification_badge(uuid) to anon, authenticated;

create policy "ID docs own upload" on storage.objects for insert to authenticated with check (bucket_id='identity-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ID docs own or admin read" on storage.objects for select to authenticated using (bucket_id='identity-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));
create policy "Chat files own upload" on storage.objects for insert to authenticated with check (bucket_id='chat-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Chat files signed-in read" on storage.objects for select to authenticated using (bucket_id='chat-files');
create policy "Chat files own delete" on storage.objects for delete to authenticated using (bucket_id='chat-files' and (storage.foldername(name))[1] = auth.uid()::text);
-- from 20261012105808_722066b4-005b-47d7-aa9a-df0f18f3aeed.sql
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.get_verification_badge(uuid) from public, anon;
grant execute on function public.get_verification_badge(uuid) to authenticated;
-- from 20261012110244_880a9c2a-16c5-4d14-8803-b9bf93c0faab.sql
create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  auth_user_id uuid not null unique,
  member_id text not null unique,
  first_name text, last_name text, full_name text,
  email text not null unique,
  email_verified boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.members to authenticated;
grant all on public.members to service_role;
alter table public.members enable row level security;
create policy "Read own profile" on public.members for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Edit own profile" on public.members for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create trigger trg_members_updated before update on public.members for each row execute function public.update_updated_at_column();

-- Block people from changing protected fields on their own profile
create or replace function public.protect_member_fields() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.member_id := old.member_id; new.email := old.email;
    new.email_verified := old.email_verified; new.auth_user_id := old.auth_user_id;
  end if;
  return new;
end $$;
create trigger trg_members_protect before update on public.members for each row execute function public.protect_member_fields();

create or replace function public.handle_new_member() returns trigger language plpgsql security definer set search_path = public as $$
declare mid text := coalesce(nullif(new.raw_user_meta_data->>'member_id',''), '10' || lpad((floor(random()*100000000))::text, 8, '0'));
begin
  insert into public.members (id, auth_user_id, member_id, first_name, last_name, full_name, email, email_verified)
  values (new.id, new.id, mid, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name',
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name','') || ' ' || coalesce(new.raw_user_meta_data->>'last_name','')), ''),
    lower(new.email), new.email_confirmed_at is not null)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_member();

create or replace function public.sync_member_email() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.members set email = lower(new.email), email_verified = new.email_confirmed_at is not null where id = new.id;
  return new;
end $$;
create trigger on_auth_user_updated after update of email, email_confirmed_at on auth.users for each row execute function public.sync_member_email();
revoke execute on function public.handle_new_member() from public, anon, authenticated;
revoke execute on function public.sync_member_email() from public, anon, authenticated;

-- Backfill existing accounts
insert into public.members (id, auth_user_id, member_id, first_name, last_name, full_name, email, email_verified)
select u.id, u.id, coalesce(nullif(u.raw_user_meta_data->>'member_id',''), '10' || lpad((floor(random()*100000000))::text, 8, '0')),
  u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name',
  nullif(trim(coalesce(u.raw_user_meta_data->>'first_name','') || ' ' || coalesce(u.raw_user_meta_data->>'last_name','')), ''),
  lower(u.email), u.email_confirmed_at is not null
from auth.users u where u.email is not null on conflict do nothing;

-- Find a person by their Nexus number (only public details)
create or replace function public.lookup_member_by_nexus_id(p_member_id text)
returns table (id uuid, member_id text, first_name text, last_name text, full_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select id, member_id, first_name, last_name, full_name, avatar_url from public.members where member_id = p_member_id limit 1 $$;
revoke execute on function public.lookup_member_by_nexus_id(text) from public, anon;
grant execute on function public.lookup_member_by_nexus_id(text) to authenticated;
-- from 20261012113128_6f6c8415-a46e-4446-84e3-c5951468a2fe.sql
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  order_id text, payment_id text, payment_status text,
  signature_valid boolean not null default false,
  outcome text not null default 'received',
  error text, payload jsonb
);
grant select on public.payment_webhook_events to authenticated;
grant all on public.payment_webhook_events to service_role;
alter table public.payment_webhook_events enable row level security;
create policy "Admins read webhook events" on public.payment_webhook_events for select to authenticated using (public.has_role(auth.uid(),'admin'));
create index on public.payment_webhook_events (received_at desc);
alter table public.members add column if not exists bio text, add column if not exists interests text[];
-- from 20261012122632_31486d60-08f7-48ec-a6e7-0d32384bd185.sql
CREATE TABLE public.auth_email_code_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);

GRANT ALL ON public.auth_email_code_limits TO service_role;

ALTER TABLE public.auth_email_code_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_auth_email_code_limit(p_bucket_key text, p_window_seconds integer, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamp with time zone;
  v_count integer;
BEGIN
  INSERT INTO public.auth_email_code_limits (bucket_key, window_start, count)
  VALUES (p_bucket_key, now(), 1)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT window_start, count INTO v_start, v_count
  FROM public.auth_email_code_limits
  WHERE bucket_key = p_bucket_key
  FOR UPDATE;

  IF v_start < now() - make_interval(secs => p_window_seconds) THEN
    UPDATE public.auth_email_code_limits
    SET window_start = now(), count = 1
    WHERE bucket_key = p_bucket_key;
    RETURN true;
  END IF;

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.auth_email_code_limits
  SET count = count + 1
  WHERE bucket_key = p_bucket_key;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_email_code_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_email_code_limit(text, integer, integer) TO service_role;
-- Contacts
create table if not exists public.contacts (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text not null, nexus_id text not null, avatar_url text, created_at timestamptz not null default now(), unique (user_id, nexus_id));
grant select, insert, update, delete on public.contacts to authenticated; grant all on public.contacts to service_role;
alter table public.contacts enable row level security;
create policy "Own contacts" on public.contacts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chat transport (replaces Appwrite)
create table public.chats (
  id uuid primary key default gen_random_uuid(), title text not null default 'New Chat', type text not null default 'private',
  avatar_url text, encrypted boolean not null default false, owner_id uuid, created_at timestamptz not null default now()
);
create table public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade, profile_id uuid not null,
  joined_at timestamptz not null default now(), primary key (chat_id, profile_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(), chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid, content text not null check (char_length(content) between 1 and 65535), type text not null default 'text',
  file_url text, file_name text, duration numeric, encrypted boolean not null default false, created_at timestamptz not null default now()
);
create index idx_chat_members_profile on public.chat_members(profile_id);
create index idx_messages_chat_created on public.messages(chat_id, created_at);
grant select, insert, update, delete on public.chats, public.chat_members, public.messages to authenticated;
grant all on public.chats, public.chat_members, public.messages to service_role;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
create or replace function public.is_chat_member(_chat uuid, _user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members where chat_id = _chat and profile_id = _user) $$;
create policy "View own chats" on public.chats for select to authenticated using (owner_id = auth.uid() or public.is_chat_member(id, auth.uid()));
create policy "Create owned chats" on public.chats for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners update chats" on public.chats for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete chats" on public.chats for delete to authenticated using (owner_id = auth.uid());
create policy "View memberships of my chats" on public.chat_members for select to authenticated using (public.is_chat_member(chat_id, auth.uid()));
create policy "Owners add members" on public.chat_members for insert to authenticated with check (exists (select 1 from public.chats c where c.id = chat_id and c.owner_id = auth.uid()));
create policy "Leave chats" on public.chat_members for delete to authenticated using (profile_id = auth.uid());
create policy "Members read messages" on public.messages for select to authenticated using (public.is_chat_member(chat_id, auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "Members send messages" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.is_chat_member(chat_id, auth.uid()));
create policy "Senders delete messages" on public.messages for delete to authenticated using (sender_id = auth.uid());
revoke execute on function public.is_chat_member(uuid, uuid) from public, anon;
grant execute on function public.is_chat_member(uuid, uuid) to authenticated, service_role;
revoke execute on function public.handle_new_member() from public, anon, authenticated;
revoke execute on function public.sync_member_email() from public, anon, authenticated;
revoke execute on function public.lookup_member_by_nexus_id(text) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.lookup_member_by_nexus_id(text) to authenticated, service_role;

alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.chat_members;
alter publication supabase_realtime add table public.storage_purchases;
