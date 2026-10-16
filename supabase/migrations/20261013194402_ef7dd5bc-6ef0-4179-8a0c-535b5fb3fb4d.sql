-- Identity: allow resubmission after rejection
CREATE POLICY "Users resubmit after rejection" ON public.identity_verifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'rejected')
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND reviewed_at IS NULL);
GRANT SELECT, INSERT, UPDATE ON public.identity_verifications TO authenticated;
GRANT ALL ON public.identity_verifications TO service_role;

-- First admin claim
CREATE OR REPLACE FUNCTION public.admin_exists() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') $$;
CREATE OR REPLACE FUNCTION public.claim_first_admin() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Confirm your email first'; END IF;
  LOCK TABLE public.user_roles IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RAISE EXCEPTION 'An admin already exists'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin');
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_exists() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- Payment settings (single row)
CREATE TABLE public.payment_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  wallet_address text,
  qr_image_url text,
  network text NOT NULL DEFAULT 'BEP20',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_settings TO authenticated;
GRANT INSERT, UPDATE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read payment settings" ON public.payment_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert payment settings" ON public.payment_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update payment settings" ON public.payment_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payment_settings_updated BEFORE UPDATE ON public.payment_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Manual USDT purchases
ALTER TABLE public.storage_purchases ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'nowpayments';
ALTER TABLE public.storage_purchases ADD COLUMN IF NOT EXISTS tx_reference text;
GRANT SELECT ON public.storage_purchases TO authenticated;
GRANT ALL ON public.storage_purchases TO service_role;
CREATE POLICY "Admins view all purchases" ON public.storage_purchases FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.submit_usdt_payment(_tier text, _tx_reference text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bytes bigint; _cents int; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT b, c INTO _bytes, _cents FROM (VALUES
    ('plus_50', 50::bigint * 1073741824, 199),
    ('plus_200', 200::bigint * 1073741824, 499),
    ('plus_1000', 1000::bigint * 1073741824, 1499)) t(k, b, c) WHERE k = _tier;
  IF _bytes IS NULL THEN RAISE EXCEPTION 'Unknown plan'; END IF;
  INSERT INTO public.storage_purchases (user_id, tier, added_bytes, amount_cents, currency, status, payment_method, tx_reference)
  VALUES (auth.uid(), _tier, _bytes, _cents, 'usdt', 'awaiting_approval', 'usdt_bep20', left(nullif(trim(_tx_reference), ''), 200))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.review_usdt_payment(_purchase_id uuid, _approve boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.storage_purchases;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO p FROM public.storage_purchases WHERE id = _purchase_id AND status = 'awaiting_approval' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not awaiting approval'; END IF;
  UPDATE public.storage_purchases SET status = CASE WHEN _approve THEN 'completed' ELSE 'rejected' END WHERE id = p.id;
  IF _approve THEN
    INSERT INTO public.user_storage_quotas (user_id, quota_bytes) VALUES (p.user_id, 5368709120 + p.added_bytes)
    ON CONFLICT (user_id) DO UPDATE SET quota_bytes = public.user_storage_quotas.quota_bytes + p.added_bytes;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_usdt_payment(text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.review_usdt_payment(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_usdt_payment(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_usdt_payment(uuid, boolean) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.storage_purchases;

-- QR image storage (bucket created separately)
CREATE POLICY "Admins upload payment QR" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-qr' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update payment QR" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'payment-qr' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Signed-in read payment QR" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-qr');