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