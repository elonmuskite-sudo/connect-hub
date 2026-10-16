
-- Admin review of ID checks: only admins, only pending rows, records reviewer and time.
create or replace function public.review_identity_verification(_id uuid, _approve boolean, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  update public.identity_verifications
    set status = case when _approve then 'approved' else 'rejected' end,
        reviewer_note = case when _approve then null else nullif(left(trim(coalesce(_note,'')), 500), '') end,
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = _id and status = 'pending';
  if not found then raise exception 'This ID check is no longer waiting for review'; end if;
end $$;
revoke execute on function public.review_identity_verification(uuid,boolean,text) from public, anon;
grant execute on function public.review_identity_verification(uuid,boolean,text) to authenticated;
