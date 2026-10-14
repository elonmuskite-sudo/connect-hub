# Appwrite identity with Supabase data

Appwrite JWTs are not Supabase access tokens. A Vercel API must verify the JWT
against Appwrite before it can act for a user in Supabase.

## Migrated paths

When `VITE_AUTH_PROVIDER=appwrite`, the client uses Appwrite for email/password
sign-in, verified-email signup, verification links, and OTP password recovery.
After Appwrite confirms the email, the gateway creates a Supabase Auth identity
with a random inaccessible password for new accounts, relying on the existing
auth trigger to create the corresponding member profile. Existing Supabase
accounts are linked only when their email is confirmed and matches.

`POST /api/data/gateway` verifies each Appwrite JWT with
`GET {APPWRITE_ENDPOINT}/account`, resolves the immutable Appwrite user ID to a
Supabase Auth UUID, and executes supported user data actions inside a database
transaction using `SET LOCAL ROLE authenticated` and transaction-local JWT
claims. Existing RLS remains the row authorization boundary. The gateway
currently supports profile and directory lookup, chat/message reads and writes,
chat/contact synchronization, message polling, and chat-file storage metadata.
Chat files upload directly to Supabase Storage only through a short-lived
single-object signed upload token; the server first authorizes the path through
RLS and never exposes a service-role key to the browser.

The service-role key is used for identity mapping/Auth account linking and
scoped Storage signing/removal after a user-scoped RLS lookup. It is not used
for arbitrary user-data queries. The database pooler connection must
authenticate as the Supabase `postgres` role so the gateway can switch to
`authenticated` within each transaction.

## Not yet migrated

This remains a staged cutover. Browser-side admin operations, payment/billing
operations, identity-document and payment-QR storage, verification flows, and
other Supabase-backed surfaces have not been moved to the gateway. Supabase
Auth/Data/Storage/Realtime remain the default provider and fallback. Do not set
`VITE_AUTH_PROVIDER=appwrite` in production until those remaining screens and
operations have been migrated and tested. In particular, the current
Appwrite-mode UI is not yet suitable for admin or payment workflows.

## Server configuration

Configure these as Vercel server environment variables, never as `VITE_`
variables:

- `APPWRITE_ENDPOINT` — Appwrite API endpoint, such as `https://cloud.appwrite.io/v1`.
- `APPWRITE_PROJECT_ID` — Appwrite project ID.
- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only key for identity linking and Auth user lookup.
- `SUPABASE_POOLER_URL` — Supabase transaction-pooler connection URL using the
  `postgres.<project-ref>` database user, port `6543`, and `sslmode=require`.

For a client build, also set the browser-visible Vite variables:
`VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`, and
`VITE_AUTH_PROVIDER`. Appwrite endpoint/project IDs are public identifiers, not
secrets. A Vercel build also needs these values in its build environment. Keep
the provider set to `supabase` until the complete migration is ready.

In the Appwrite Console, allow the production web origin (`nexus-chat-world.com`)
as a Web platform and enable the password policy option that rejects breached
passwords and blocks sign-in with them. This Appwrite policy is the project-wide
password restriction; the app's HIBP range check alone is only a client/app
check.

The `appwrite_identity_links` migration and the SQL grants/policies must be
applied before using the gateway. The migration has not been applied to the
production Supabase project. Never send the pooler URL or service-role key to
the browser.
