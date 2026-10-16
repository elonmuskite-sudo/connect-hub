create table public.appwrite_identity_links (
  appwrite_user_id text primary key,
  supabase_user_id uuid not null unique references auth.users(id) on delete cascade,
  linked_email text not null,
  linked_at timestamptz not null default now()
);

alter table public.appwrite_identity_links enable row level security;
revoke all on public.appwrite_identity_links from public, anon, authenticated;
grant all on public.appwrite_identity_links to service_role;