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