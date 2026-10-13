CREATE TABLE public.storage_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chat_id TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'file',
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  duration_seconds NUMERIC,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_files TO authenticated;
GRANT ALL ON public.storage_files TO service_role;
ALTER TABLE public.storage_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own files" ON public.storage_files FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own files" ON public.storage_files FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own files" ON public.storage_files FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  nexus_id TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, nexus_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own contacts" ON public.contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;

CREATE POLICY "Users can upload to their own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can read their own folder" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete from their own folder" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);