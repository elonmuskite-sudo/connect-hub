CREATE SCHEMA IF NOT EXISTS private;
ALTER FUNCTION public.admin_update_member(uuid,text,text,text) SET SCHEMA private;
ALTER FUNCTION public.admin_set_admin_role(uuid,boolean) SET SCHEMA private;
ALTER FUNCTION public.admin_list_admins() SET SCHEMA private;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.admin_update_member(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.admin_set_admin_role(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION private.admin_list_admins() TO authenticated;

CREATE FUNCTION public.admin_update_member(_member_id uuid, _first_name text, _last_name text, _bio text)
RETURNS void LANGUAGE sql SET search_path = public AS $$ select private.admin_update_member(_member_id,_first_name,_last_name,_bio) $$;
CREATE FUNCTION public.admin_set_admin_role(_user_id uuid, _grant boolean)
RETURNS void LANGUAGE sql SET search_path = public AS $$ select private.admin_set_admin_role(_user_id,_grant) $$;
CREATE FUNCTION public.admin_list_admins()
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SET search_path = public AS $$ select * from private.admin_list_admins() $$;
REVOKE ALL ON FUNCTION public.admin_update_member(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_admin_role(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_member(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_admin_role(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;