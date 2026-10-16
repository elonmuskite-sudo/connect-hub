CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.user_storage_quotas (user_id uuid PRIMARY KEY, quota_bytes bigint NOT NULL DEFAULT 5368709120, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.user_storage_quotas TO authenticated;
GRANT ALL ON public.user_storage_quotas TO service_role;
ALTER TABLE public.user_storage_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own quota" ON public.user_storage_quotas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_quota_updated BEFORE UPDATE ON public.user_storage_quotas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.storage_purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, tier text NOT NULL, added_bytes bigint NOT NULL, amount_cents integer NOT NULL, currency text NOT NULL DEFAULT 'usd', status text NOT NULL DEFAULT 'pending', checkout_session_id text UNIQUE, receipt_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.storage_purchases TO authenticated;
GRANT ALL ON public.storage_purchases TO service_role;
ALTER TABLE public.storage_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own purchases" ON public.storage_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_purchases_updated BEFORE UPDATE ON public.storage_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.identity_verifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending', match_score numeric, selfie_path text NOT NULL, id_document_path text NOT NULL, reviewer_note text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.identity_verifications TO authenticated;
GRANT ALL ON public.identity_verifications TO service_role;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own verification" ON public.identity_verifications FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users submit own pending verification" ON public.identity_verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending' AND reviewed_at IS NULL);
CREATE POLICY "Admins review verifications" ON public.identity_verifications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_idv_updated BEFORE UPDATE ON public.identity_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_verification_badge(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.identity_verifications WHERE user_id = _user_id AND status = 'approved') THEN 'authenticated'
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND email_confirmed_at IS NOT NULL) THEN 'verified'
    ELSE 'none' END $$;
GRANT EXECUTE ON FUNCTION public.get_verification_badge(uuid) TO authenticated;

CREATE POLICY "Users upload own identity docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'identity-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users and admins read identity docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'identity-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));