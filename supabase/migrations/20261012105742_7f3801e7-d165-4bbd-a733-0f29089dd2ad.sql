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