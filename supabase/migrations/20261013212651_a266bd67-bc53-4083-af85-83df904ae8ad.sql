create unique index if not exists identity_verifications_user_id_key on public.identity_verifications(user_id);
create or replace function public.stamp_idv_review() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status in ('approved','rejected') and new.status is distinct from old.status then
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_idv_review on public.identity_verifications;
create trigger trg_idv_review before update on public.identity_verifications for each row execute function public.stamp_idv_review();