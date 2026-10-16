revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.get_verification_badge(uuid) from public, anon;
grant execute on function public.get_verification_badge(uuid) to authenticated;