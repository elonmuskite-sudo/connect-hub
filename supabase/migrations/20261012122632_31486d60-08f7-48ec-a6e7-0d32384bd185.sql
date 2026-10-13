CREATE TABLE public.auth_email_code_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);

GRANT ALL ON public.auth_email_code_limits TO service_role;

ALTER TABLE public.auth_email_code_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_auth_email_code_limit(p_bucket_key text, p_window_seconds integer, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamp with time zone;
  v_count integer;
BEGIN
  INSERT INTO public.auth_email_code_limits (bucket_key, window_start, count)
  VALUES (p_bucket_key, now(), 1)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT window_start, count INTO v_start, v_count
  FROM public.auth_email_code_limits
  WHERE bucket_key = p_bucket_key
  FOR UPDATE;

  IF v_start < now() - make_interval(secs => p_window_seconds) THEN
    UPDATE public.auth_email_code_limits
    SET window_start = now(), count = 1
    WHERE bucket_key = p_bucket_key;
    RETURN true;
  END IF;

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.auth_email_code_limits
  SET count = count + 1
  WHERE bucket_key = p_bucket_key;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_email_code_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_email_code_limit(text, integer, integer) TO service_role;