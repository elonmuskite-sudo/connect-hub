create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  member_id text not null unique,
  first_name text not null,
  last_name text not null,
  full_name text,
  password text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.members add column if not exists email text;
alter table public.members add column if not exists email_verified boolean not null default false;
alter table public.members add column if not exists role text not null default 'user';
alter table public.members add column if not exists avatar_url text;
alter table public.members add column if not exists created_at timestamptz not null default now();
alter table public.members add column if not exists auth_user_id uuid unique references auth.users (id) on delete cascade;
alter table public.members alter column password drop not null;

create unique index if not exists idx_members_email
  on public.members (email)
  where email is not null;
create index if not exists idx_members_role on public.members (role);

create table if not exists public.profiles (
  id uuid primary key references public.members (id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'private',
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (chat_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  content text not null,
  type text not null default 'text',
  file_url text,
  file_name text,
  encrypted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_chats_owner_id on public.chats (owner_id);
create index if not exists idx_chats_created_at on public.chats (created_at);
create index if not exists idx_chat_members_profile_id on public.chat_members (profile_id);
create index if not exists idx_messages_chat_id on public.messages (chat_id);
create index if not exists idx_messages_created_at on public.messages (created_at);

alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Members can view non-admin accounts" on public.members;
create policy "Members can view non-admin accounts"
  on public.members for select
  using (role is distinct from 'supabase_admin');

drop policy if exists "Admin self read" on public.members;
create policy "Admin self read"
  on public.members for select
  using (role = 'supabase_admin' and auth.uid() = id);

drop policy if exists "Members can create regular accounts" on public.members;
create policy "Members can create regular accounts"
  on public.members for insert
  with check (role = 'user');

drop policy if exists "Members can update their own account" on public.members;
create policy "Members can update their own account"
  on public.members for update
  using (auth.uid() = id and role = 'user')
  with check (auth.uid() = id and role = 'user');

drop policy if exists "Members can delete their own account" on public.members;
create policy "Members can delete their own account"
  on public.members for delete
  using (auth.uid() = id and role = 'user');

drop policy if exists "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Members can create their own profile" on public.profiles;
create policy "Members can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Members can update their own profile" on public.profiles;
create policy "Members can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Members can delete their own profile" on public.profiles;
create policy "Members can delete their own profile"
  on public.profiles for delete
  using (auth.uid() = id);

drop policy if exists "Chat members can view chats" on public.chats;
create policy "Chat members can view chats"
  on public.chats for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.chat_members cm
      where cm.chat_id = id and cm.profile_id = auth.uid()
    )
  );

drop policy if exists "Members can create owned chats" on public.chats;
create policy "Members can create owned chats"
  on public.chats for insert
  with check (owner_id = auth.uid());

drop policy if exists "Chat owners can update chats" on public.chats;
create policy "Chat owners can update chats"
  on public.chats for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Chat owners can delete chats" on public.chats;
create policy "Chat owners can delete chats"
  on public.chats for delete
  using (owner_id = auth.uid());

drop policy if exists "Members can view their chat memberships" on public.chat_members;
create policy "Members can view their chat memberships"
  on public.chat_members for select
  using (profile_id = auth.uid());

drop policy if exists "Members can join chats as themselves" on public.chat_members;
create policy "Members can join chats as themselves"
  on public.chat_members for insert
  with check (profile_id = auth.uid());

drop policy if exists "Members can leave chats themselves" on public.chat_members;
create policy "Members can leave chats themselves"
  on public.chat_members for delete
  using (profile_id = auth.uid());

drop policy if exists "Chat members can view messages" on public.messages;
create policy "Chat members can view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id and cm.profile_id = auth.uid()
    )
  );

drop policy if exists "Chat members can send messages" on public.messages;
create policy "Chat members can send messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id and cm.profile_id = auth.uid()
    )
  );

drop policy if exists "Senders can update their messages" on public.messages;
create policy "Senders can update their messages"
  on public.messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists "Senders can delete their messages" on public.messages;
create policy "Senders can delete their messages"
  on public.messages for delete
  using (sender_id = auth.uid());

revoke all on public.members from anon, authenticated;
grant select (id, member_id, first_name, last_name, full_name, avatar_url, email, email_verified, role, created_at)
  on public.members to anon, authenticated;
grant insert (member_id, first_name, last_name, full_name, password, avatar_url, email, email_verified, role)
  on public.members to anon, authenticated;
grant update (member_id, first_name, last_name, full_name, password, avatar_url, email, email_verified, role)
  on public.members to authenticated;
grant delete on public.members to authenticated;
grant all on public.members, public.profiles, public.chats, public.chat_members, public.messages to service_role;
grant select, insert, update, delete on public.profiles, public.chats, public.chat_members, public.messages to authenticated;

create or replace function public.verify_member_login(p_member_id text, p_password text)
returns table (
  id uuid,
  member_id text,
  first_name text,
  last_name text,
  full_name text,
  email text,
  email_verified boolean,
  role text,
  avatar_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select m.id, m.member_id, m.first_name, m.last_name, m.full_name,
         m.email, m.email_verified, m.role, m.avatar_url, m.created_at
  from public.members m
  where m.member_id = p_member_id and m.password = p_password
$$;

revoke all on function public.verify_member_login(text, text) from public;
grant execute on function public.verify_member_login(text, text) to anon, authenticated, service_role;

create or replace function public.current_member_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.members where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.current_member_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where auth_user_id = auth.uid() and role in ('admin', 'supabase_admin', 'appwrite_admin')
  )
$$;

create or replace function public.create_member_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_member_id text;
  new_member_row_id uuid;
  first_name_value text;
  last_name_value text;
  full_name_value text;
begin
  first_name_value := coalesce(nullif(new.raw_user_meta_data->>'first_name', ''), 'Nexus');
  last_name_value := coalesce(nullif(new.raw_user_meta_data->>'last_name', ''), 'Member');
  full_name_value := trim(first_name_value || ' ' || last_name_value);
  new_member_id := new.raw_user_meta_data->>'member_id';

  if new_member_id !~ '^10[0-9]{8}$' then
    raise exception 'A valid Nexus member ID is required';
  end if;

  insert into public.members (
    id, auth_user_id, member_id, first_name, last_name, full_name, email, email_verified, role
  ) values (
    new.id, new.id, new_member_id, first_name_value, last_name_value, full_name_value,
    new.email, new.email_confirmed_at is not null, 'user'
  ) returning id into new_member_row_id;

  insert into public.profiles (id, email, full_name)
  values (new_member_row_id, new.email, full_name_value)
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_nexus_member on auth.users;
create trigger on_auth_user_created_nexus_member
  after insert on auth.users
  for each row execute procedure public.create_member_for_auth_user();

create or replace function public.sync_member_email_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row_id uuid;
begin
  update public.members
  set email = new.email,
      email_verified = new.email_confirmed_at is not null
  where auth_user_id = new.id
  returning id into member_row_id;

  if member_row_id is not null then
    update public.profiles
    set email = new.email
    where id = member_row_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated_nexus_email on auth.users;
create trigger on_auth_user_updated_nexus_email
  after update of email, email_confirmed_at on auth.users
  for each row execute procedure public.sync_member_email_from_auth_user();

drop function if exists public.verify_member_login(text, text);
revoke all on function public.current_member_profile_id() from public, anon;
revoke all on function public.current_member_is_admin() from public, anon;
revoke all on function public.create_member_for_auth_user() from public, anon, authenticated;
revoke all on function public.sync_member_email_from_auth_user() from public, anon, authenticated;
grant execute on function public.current_member_profile_id() to authenticated, service_role;
grant execute on function public.current_member_is_admin() to authenticated, service_role;

revoke all on public.members from anon, authenticated;
revoke all privileges (id, auth_user_id, member_id, first_name, last_name, full_name, password, avatar_url, email, email_verified, role, created_at)
  on table public.members from anon, authenticated;
grant select (id, member_id, first_name, last_name, full_name, avatar_url, email, email_verified, role, created_at)
  on public.members to authenticated;
grant update (first_name, last_name, full_name, avatar_url)
  on public.members to authenticated;
grant all on public.members to service_role;

drop policy if exists "Members can view non-admin accounts" on public.members;
drop policy if exists "Admin self read" on public.members;
drop policy if exists "Members can create regular accounts" on public.members;
drop policy if exists "Members can update their own account" on public.members;
drop policy if exists "Members can delete their own account" on public.members;
drop policy if exists "Members read own profile" on public.members;
drop policy if exists "Admins read member profiles" on public.members;
drop policy if exists "Members update own profile" on public.members;
create policy "Members read own profile" on public.members
  for select to authenticated using (auth_user_id = auth.uid());
create policy "Admins read member profiles" on public.members
  for select to authenticated using (public.current_member_is_admin());
create policy "Members update own profile" on public.members
  for update to authenticated using (auth_user_id = auth.uid() and role = 'user')
  with check (auth_user_id = auth.uid() and role = 'user');

drop policy if exists "Profiles are readable by their owner" on public.profiles;
drop policy if exists "Members can create their own profile" on public.profiles;
drop policy if exists "Members can update their own profile" on public.profiles;
drop policy if exists "Members can delete their own profile" on public.profiles;
drop policy if exists "Members update own profile" on public.profiles;
create policy "Members read own profile" on public.profiles
  for select to authenticated using (id = public.current_member_profile_id());
create policy "Members update own profile" on public.profiles
  for update to authenticated using (id = public.current_member_profile_id())
  with check (id = public.current_member_profile_id());

drop policy if exists "Chat members can view chats" on public.chats;
drop policy if exists "Members can create owned chats" on public.chats;
drop policy if exists "Chat owners can update chats" on public.chats;
drop policy if exists "Chat owners can delete chats" on public.chats;
create policy "Chat members can view chats" on public.chats
  for select to authenticated using (
    owner_id = public.current_member_profile_id()
    or exists (
      select 1 from public.chat_members cm
      where cm.chat_id = chats.id and cm.profile_id = public.current_member_profile_id()
    )
  );
create policy "Members can create owned chats" on public.chats
  for insert to authenticated with check (owner_id = public.current_member_profile_id());
create policy "Chat owners can update chats" on public.chats
  for update to authenticated using (owner_id = public.current_member_profile_id())
  with check (owner_id = public.current_member_profile_id());
create policy "Chat owners can delete chats" on public.chats
  for delete to authenticated using (owner_id = public.current_member_profile_id());

drop policy if exists "Members can view their chat memberships" on public.chat_members;
drop policy if exists "Members can join chats as themselves" on public.chat_members;
drop policy if exists "Members can leave chats themselves" on public.chat_members;
create policy "Members can view their chat memberships" on public.chat_members
  for select to authenticated using (profile_id = public.current_member_profile_id());
create policy "Members can join chats as themselves" on public.chat_members
  for insert to authenticated with check (profile_id = public.current_member_profile_id());
create policy "Members can leave chats themselves" on public.chat_members
  for delete to authenticated using (profile_id = public.current_member_profile_id());

drop policy if exists "Chat members can view messages" on public.messages;
drop policy if exists "Chat members can send messages" on public.messages;
drop policy if exists "Senders can update their messages" on public.messages;
drop policy if exists "Senders can delete their messages" on public.messages;
create policy "Chat members can view messages" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id
        and cm.profile_id = public.current_member_profile_id()
    )
  );
create policy "Chat members can send messages" on public.messages
  for insert to authenticated with check (
    sender_id = public.current_member_profile_id()
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id
        and cm.profile_id = public.current_member_profile_id()
    )
  );
create policy "Senders can update their messages" on public.messages
  for update to authenticated using (sender_id = public.current_member_profile_id())
  with check (sender_id = public.current_member_profile_id());
create policy "Senders can delete their messages" on public.messages
  for delete to authenticated using (sender_id = public.current_member_profile_id());

create table if not exists public.auth_email_code_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1
);

alter table public.auth_email_code_rate_limits enable row level security;
revoke all on public.auth_email_code_rate_limits from public, anon, authenticated;
grant all on public.auth_email_code_rate_limits to service_role;

create or replace function public.consume_auth_email_code_limit(
  p_bucket_key text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  allowed boolean;
begin
  if p_bucket_key is null or length(p_bucket_key) <> 64
    or p_window_seconds < 1 or p_limit < 1 then
    raise exception 'Invalid email code rate-limit parameters';
  end if;

  insert into public.auth_email_code_rate_limits as rate_limit (
    bucket_key, window_started_at, request_count
  ) values (
    p_bucket_key, now(), 1
  )
  on conflict (bucket_key) do update set
    window_started_at = case
      when rate_limit.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else rate_limit.window_started_at
    end,
    request_count = case
      when rate_limit.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else rate_limit.request_count + 1
    end
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_auth_email_code_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_email_code_limit(text, integer, integer) to service_role;
