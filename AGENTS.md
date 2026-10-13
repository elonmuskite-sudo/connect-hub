<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
<<<<<<< HEAD

# Architecture rules
- Chat transport is Supabase tables (chats, chat_members, messages) with postgres_changes realtime; Appwrite was removed so there is one backend.
- Production runs on the user's own Supabase project via Vercel env vars; docs/supabase-schema.sql is the schema to apply there, since that project is not managed from Lovable.
- Encode reactions and reply metadata with the versioned chat protocol in existing message fields; this preserves compatibility without requiring unprovisioned database columns.
- Centralize chat controls in ChatButton and chat presentation effects in global semantic-token CSS; this keeps interaction and theme behavior consistent.
=======
>>>>>>> 39c3019adaf9289486d7b06780a3e0f5c054d086
