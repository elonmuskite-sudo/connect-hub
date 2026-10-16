CREATE OR REPLACE FUNCTION public.admin_update_member(_member_id uuid, _first_name text, _last_name text, _bio text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.members SET
    first_name = left(trim(_first_name), 80),
    last_name = left(trim(_last_name), 80),
    full_name = left(trim(coalesce(_first_name,'') || ' ' || coalesce(_last_name,'')), 161),
    bio = left(_bio, 500),
    updated_at = now()
  WHERE id = _member_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_admin_role(_user_id uuid, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role)
    SELECT _user_id, 'admin' WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='admin');
  ELSE
    IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove your own admin role'; END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE(user_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin';
END $$;

REVOKE ALL ON FUNCTION public.admin_update_member(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_admin_role(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_member(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_admin_role(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;