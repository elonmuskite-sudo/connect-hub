create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nexus_id text not null unique check (nexus_id ~ '^10[0-9]{8}$'),
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','support')),
  user_a uuid not null,
  user_b uuid,
  last_message text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index conversations_direct_pair on public.conversations (least(user_a, user_b), greatest(user_a, user_b)) where kind = 'direct';
create index conversations_user_a on public.conversations (user_a);
create index conversations_user_b on public.conversations (user_b);
grant select on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid,
  sender_kind text not null default 'user' check (sender_kind in ('user','admin','bot','system')),
  type text not null default 'text',
  content text not null check (char_length(content) between 1 and 65535),
  encrypted boolean not null default false,
  file_url text,
  file_name text,
  created_at timestamptz not null default now()
);
create index messages_conversation on public.messages (conversation_id, created_at);
grant select, insert, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'bot' check (status in ('bot','waiting','active','closed')),
  admin_id uuid,
  reason text,
  created_at timestamptz not null default now(),
  waiting_since timestamptz,
  claimed_at timestamptz,
  closed_at timestamptz
);
create index support_requests_status on public.support_requests (status, waiting_since);
grant select on public.support_requests to authenticated;
grant all on public.support_requests to service_role;
alter table public.support_requests enable row level security;

create table public.saved_contacts (
  owner_id uuid not null,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id)
);
grant select, insert, update, delete on public.saved_contacts to authenticated;
grant all on public.saved_contacts to service_role;
alter table public.saved_contacts enable row level security;
create policy "Owners manage saved contacts" on public.saved_contacts for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- helpers
create or replace function public.is_conversation_member(_conv uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.conversations c where c.id = _conv and (c.user_a = _user or c.user_b = _user)) $$;

create or replace function public.can_view_conversation(_conv uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.conversations c where c.id = _conv
  and (c.user_a = _user or c.user_b = _user or (c.kind = 'support' and public.has_role(_user, 'admin')))
) $$;

create or replace function public.shares_conversation(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.conversations c where (c.user_a = _a and c.user_b = _b) or (c.user_a = _b and c.user_b = _a)) $$;

-- policies
create policy "Profiles visible to self, chat partners, contacts and admins" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or public.shares_conversation(auth.uid(), id)
    or exists (select 1 from public.saved_contacts s where s.owner_id = auth.uid() and s.contact_id = profiles.id)
  );
create policy "Users update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, full_name, avatar_url) on public.profiles to authenticated;

create policy "Participants and support admins view conversations" on public.conversations for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid() or (kind = 'support' and public.has_role(auth.uid(), 'admin')));

create policy "Viewers read messages" on public.messages for select to authenticated
  using (public.can_view_conversation(conversation_id, auth.uid()));
create policy "Participants send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and sender_kind in ('user','admin') and public.is_conversation_member(conversation_id, auth.uid()));
create policy "Senders delete own messages" on public.messages for delete to authenticated
  using (sender_id = auth.uid());

create policy "Owners and admins view support requests" on public.support_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- message trigger: set sender kind, bump conversation
create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare conv public.conversations;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if new.sender_kind in ('user','admin') and new.sender_id is not null then
    if conv.kind = 'support' and new.sender_id <> conv.user_a and public.has_role(new.sender_id, 'admin') then
      new.sender_kind := 'admin';
    else
      new.sender_kind := 'user';
    end if;
  end if;
  if new.type <> 'reaction' then
    update public.conversations
      set last_message = case when new.encrypted then 'Encrypted message' else left(new.content, 200) end,
          last_message_at = new.created_at
      where id = new.conversation_id;
  end if;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages for each row execute function public.on_message_insert();

-- signup trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  new_id text;
  fn text := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), split_part(new.email, '@', 1));
  ln text := coalesce(trim(new.raw_user_meta_data->>'last_name'), '');
begin
  loop
    new_id := '10' || lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    exit when not exists (select 1 from public.profiles where nexus_id = new_id);
  end loop;
  insert into public.profiles (id, nexus_id, first_name, last_name, full_name)
    values (new.id, new_id, fn, ln, trim(fn || ' ' || ln));
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RPCs
create or replace function public.lookup_member_by_nexus_id(p_nexus_id text)
returns table (id uuid, nexus_id text, first_name text, last_name text, full_name text, avatar_url text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.nexus_id, p.first_name, p.last_name, p.full_name, p.avatar_url
  from public.profiles p
  where auth.uid() is not null and p.nexus_id = regexp_replace(coalesce(p_nexus_id, ''), '\D', '', 'g')
  limit 1
$$;
revoke all on function public.lookup_member_by_nexus_id(text) from public, anon;
grant execute on function public.lookup_member_by_nexus_id(text) to authenticated;

create or replace function public.start_direct_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_other is null or p_other = me then raise exception 'Choose a different member'; end if;
  if not exists (select 1 from public.profiles where id = p_other) then raise exception 'Member not found'; end if;
  select id into cid from public.conversations
    where kind = 'direct' and least(user_a, user_b) = least(me, p_other) and greatest(user_a, user_b) = greatest(me, p_other);
  if cid is null then
    insert into public.conversations (kind, user_a, user_b, last_message) values ('direct', me, p_other, null) returning id into cid;
  end if;
  return cid;
end $$;
revoke all on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.start_support_conversation()
returns uuid language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select r.conversation_id into cid from public.support_requests r
    where r.user_id = me and r.status <> 'closed' order by r.created_at desc limit 1;
  if cid is null then
    insert into public.conversations (kind, user_a) values ('support', me) returning id into cid;
    insert into public.support_requests (conversation_id, user_id) values (cid, me);
    insert into public.messages (conversation_id, sender_kind, content)
      values (cid, 'bot', 'Hi! I''m Nexus Assist. Tell me what you need help with — or tap "Talk to a person" any time to reach a live admin.');
  end if;
  return cid;
end $$;
revoke all on function public.start_support_conversation() from public, anon;
grant execute on function public.start_support_conversation() to authenticated;

create or replace function public.request_live_agent(p_conversation uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  update public.support_requests
    set status = 'waiting', waiting_since = now(), reason = coalesce(p_reason, reason)
    where conversation_id = p_conversation and user_id = me and status = 'bot';
  if found then
    insert into public.messages (conversation_id, sender_kind, content)
      values (p_conversation, 'system', 'You''re in the queue. A live admin will join this chat shortly.');
  end if;
end $$;
revoke all on function public.request_live_agent(uuid, text) from public, anon;
grant execute on function public.request_live_agent(uuid, text) to authenticated;

create or replace function public.claim_support_request(p_request uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); cid uuid; nm text;
begin
  if not public.has_role(me, 'admin') then raise exception 'Admins only'; end if;
  update public.support_requests set status = 'active', admin_id = me, claimed_at = now()
    where id = p_request and status = 'waiting' returning conversation_id into cid;
  if cid is null then raise exception 'This request was already taken or closed'; end if;
  update public.conversations set user_b = me where id = cid;
  select full_name into nm from public.profiles where id = me;
  insert into public.messages (conversation_id, sender_kind, content)
    values (cid, 'system', coalesce(nullif(nm, ''), 'An admin') || ' joined the chat.');
  return cid;
end $$;
revoke all on function public.claim_support_request(uuid) from public, anon;
grant execute on function public.claim_support_request(uuid) to authenticated;

create or replace function public.close_support_request(p_conversation uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  update public.support_requests set status = 'closed', closed_at = now()
    where conversation_id = p_conversation and status <> 'closed'
      and (user_id = me or (admin_id = me and public.has_role(me, 'admin')));
  if found then
    insert into public.messages (conversation_id, sender_kind, content)
      values (p_conversation, 'system', 'This support chat was closed.');
  end if;
end $$;
revoke all on function public.close_support_request(uuid) from public, anon;
grant execute on function public.close_support_request(uuid) to authenticated;

alter table public.messages replica identity full;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.support_requests;