-- Allow signed-in users to resolve a Nexus ID to the minimal profile needed to start a chat.
-- This does not expose email, role, or other private member fields.
create or replace function public.lookup_member_by_nexus_id(p_member_id text)
returns table (
  id uuid,
  member_id text,
  first_name text,
  last_name text,
  full_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.id, m.member_id, m.first_name, m.last_name, m.full_name, m.avatar_url
  from public.members m
  where auth.uid() is not null
    and m.member_id = regexp_replace(coalesce(p_member_id, ''), '[^0-9]', '', 'g')
  limit 1
$$;

revoke all on function public.lookup_member_by_nexus_id(text) from public, anon;
grant execute on function public.lookup_member_by_nexus_id(text) to authenticated;
