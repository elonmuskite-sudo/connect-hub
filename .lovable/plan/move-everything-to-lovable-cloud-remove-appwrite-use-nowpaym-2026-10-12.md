# Move everything to Lovable Cloud, remove Appwrite, use NOWPayments

## What changes for you
- Chats, messages, and group members are saved in Lovable Cloud. Appwrite is removed completely.
- Messages already stored in Appwrite will **not** carry over. Old conversations disappear, and people start fresh.
- All keys are kept in Lovable Cloud's secure secret store. None of them go in the code.
- Storage upgrades are paid through NOWPayments (crypto checkout). The receipts and webhook log stay as they are now.
- The Vercel build no longer fails on missing Appwrite and admin values.

## Keys I will ask you for (secure form, after approval)
- `RESEND_API_KEY`: from your Resend dashboard → API Keys
- `RESEND_FROM`: the sender address, e.g. `Nexus <admin@nexus-chat-world.com>`
- `NOWPAYMENTS_API_KEY`: from NOWPayments → Store Settings → API keys
- `NOWPAYMENTS_IPN_SECRET`: from NOWPayments → Store Settings → IPN secret
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: used once to create and promote your admin account

The Supabase address and keys are already provided automatically by Lovable Cloud, so you don't need to enter them.

## Technical details
- Chat tables: reuse the `chats`, `chat_members`, and `messages` tables from the initial migration. A new migration checks their RLS (members can only read or write chats they belong to), adds the GRANTs, and adds `messages` to the realtime publication.
- Rewrite `src/lib/persistence.js` to use the Supabase client and `postgres_changes` realtime. Keep the chat protocol encoding in the existing message fields.
- Delete `src/lib/appwrite*.js`, `scripts/setup-appwrite.js`, `appwrite.config.json`, and `docs/appwrite-platform-setup.md`. Remove the `appwrite` package and the Appwrite admin panel in Settings. Move `isAdminRole` into AuthContext, and update ChatView, AdminDashboard, main.jsx, and env.d.ts.
- Send email codes through the `email-code` edge function using Resend secrets. The Vercel `/api` copy is removed so there is only one path.
- Add an admin bootstrap edge function. It reads `ADMIN_EMAIL`/`ADMIN_PASSWORD`, creates the auth user if missing, and grants the admin role in `user_roles`. Only a caller holding the cron secret can run it.
- NOWPayments: the existing checkout and webhook functions are kept. Make sure the webhook verifies the HMAC-SHA512 signature with `NOWPAYMENTS_IPN_SECRET`.
- Env scripts (`generate-runtime-env`, `validate-production-env`, `sync-vercel-env`) only require `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, plus `.env.example` and the docs.
- Replace the AGENTS.md rule "keep Appwrite message transport" with "chat transport is Lovable Cloud tables and realtime".
