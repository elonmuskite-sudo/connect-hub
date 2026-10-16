# Supabase Database Initialization Script - Product Requirements Document

## Overview
- **Summary**: Production-ready, idempotent Supabase database initialization and admin user provisioning system for Nexus Chat. Creates a dedicated admin account (elonmuskite@gmail.com / Jagaban@1) with `supabase_admin` role, enforced email verification, RLS-protected admin record, and comprehensive error handling across local, staging, and production environments.
- **Purpose**: Automate consistent database provisioning, eliminate manual admin setup errors, enforce security boundaries between admin and regular users, and enable CI/CD pipeline-compatible deployments.
- **Target Users**: DevOps engineers, backend administrators, CI/CD pipelines, and local developers provisioning Nexus Chat instances.

## Goals
- Provision all required database schemas, tables, and RLS policies in a single script execution
- Create a fixed admin user with verified email and highest-privilege role
- Prevent duplicate admin accounts via unique constraints and idempotent logic
- Restrict all non-admin users from reading or modifying the admin record via RLS
- Provide clear, actionable error messages for all common failure modes
- Support local Supabase CLI, staging, and production environments with environment-based configuration
- Expose package.json scripts for zero-effort execution

## Non-Goals
- Implement end-user registration/login flows (handled by existing AuthContext)
- Create additional application tables beyond schema provisioning and admin user setup
- Implement audit logging or change tracking for admin actions
- Provide a GUI admin panel for user management (handled by existing AdminDashboard)
- Migrate existing user data between environments

## Background & Context
- Nexus Chat currently uses a custom `members` table for user storage (not Supabase `auth.users`) with plaintext passwords per `supabase-schema.sql`
- Existing schema defines 5 tables: `members`, `profiles`, `chats`, `chat_members`, `messages` with basic RLS enabled
- Application uses `@supabase/supabase-js` v2 with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- Admin dashboard exists at `src/pages/AdminDashboard.jsx` — needs a valid admin account for access
- `scripts/` directory contains existing Node.js scripts (CommonJS `.cjs` and ESM `.js` variants)

## Functional Requirements

### Schema Provisioning
- **FR-1**: Execute `supabase-schema.sql` idempotently using `IF NOT EXISTS` semantics for all DDL
- **FR-2**: Add `email text unique`, `email_verified boolean default false`, and `role text default 'user'` columns to the `members` table if missing
- **FR-3**: Enable RLS on the `profiles` table (currently missing from schema)
- **FR-4**: Create a unique constraint on `members.email` to prevent duplicate admin emails at the database level

### Admin User Provisioning
- **FR-5**: Create admin user in `members` table with:
  - `email`: 'elonmuskite@gmail.com'
  - `password`: 'Jagaban@1' (stored as provided per existing app convention; marked for future hashing)
  - `role`: 'supabase_admin'
  - `email_verified`: true
  - `first_name`: 'System'
  - `last_name`: 'Administrator'
  - `full_name`: 'System Administrator'
  - `member_id`: deterministic '1000000000' (avoids collision with auto-generated 10xxxxxxxxx IDs)
- **FR-6**: Upsert semantics: if admin record already exists by `email` or `member_id`, skip creation (no overwrite of existing data)

### Security & RLS
- **FR-7**: Create RLS policy on `members` table restricting SELECT/UPDATE/DELETE of the admin record to only the admin's own user id (via `auth.uid()` match or role-based check)
- **FR-8**: Create RLS policy ensuring regular users cannot read the `supabase_admin` role record
- **FR-9**: Ensure `members.password` column is never exposed via SELECT policies that apply to non-admin self-service reads

### Script Execution & Error Handling
- **FR-10**: Accept configuration via environment variables with fallback to `.env` file:
  - `SUPABASE_URL` / `VITE_SUPABASE_URL`: Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations (required)
  - `SUPABASE_ANON_KEY`: Anon key (optional fallback)
  - `ADMIN_EMAIL`: Override admin email (optional, default elonmuskite@gmail.com)
  - `ADMIN_PASSWORD`: Override admin password (optional, default Jagaban@1)
  - `NODE_ENV`: local | staging | production
- **FR-11**: Handle and classify these error categories with distinct exit codes and messages:
  - Exit 1: Missing required env vars or invalid credential format
  - Exit 2: Database connection failure (network, URL, or auth)
  - Exit 3: Permission errors (insufficient key privileges)
  - Exit 4: Unique constraint violation on admin email (race condition)
  - Exit 5: SQL syntax or migration execution error
  - Exit 0: Success (admin created or already exists)
- **FR-12**: Validate credential format before execution:
  - Email: standard RFC 5322 regex validation
  - Password: minimum 8 chars, at least one uppercase, one lowercase, one number, one special char

### Post-Deployment Verification
- **FR-13**: After provisioning, verify admin account by:
  - Querying `members` for the admin email and confirming `role = 'supabase_admin'` and `email_verified = true`
  - Validating that a non-admin query attempt to read the admin record returns empty
  - Confirming duplicate execution returns success without creating new rows

## Non-Functional Requirements
- **NFR-1**: Script must be idempotent — running 2+ times produces identical final state with no errors
- **NFR-2**: Cross-platform: runs on Windows PowerShell, macOS zsh, Linux bash via Node.js
- **NFR-3**: Completes schema + admin setup in < 30 seconds against a healthy Supabase instance
- **NFR-4**: Zero hardcoded secrets in the script file itself; all credentials pulled from environment
- **NFR-5**: All SQL operations wrapped in transactions where possible for atomicity
- **NFR-6**: Dry-run mode (`--dry-run` flag) prints planned operations without executing writes

## Constraints
- **Technical**: Must use `@supabase/supabase-js` v2 (already in package.json); no additional runtime dependencies beyond what's installed
- **Technical**: Script must work with both local Supabase CLI (`supabase start`) and cloud-hosted Supabase projects
- **Business**: Admin email and password are hard requirements — must be exactly as specified when env overrides are not set
- **Dependencies**: Relies on existing `supabase-schema.sql` at project root; must not break existing table structure
- **Dependencies**: `scripts/` convention supports both `.cjs` (CommonJS) and `.js` (ESM); choose `.cjs` for broader env compatibility

## Assumptions
- `SUPABASE_SERVICE_ROLE_KEY` is available in the environment for script execution (anon key has insufficient privileges for DDL and user upserts bypassing RLS)
- Existing `members` rows without `email` will retain NULL values; only the admin record requires non-null email
- Passwords are stored as plaintext in `members.password` consistent with current `AuthContext.jsx` login logic (string comparison); bcrypt/argon hashing is noted as a future improvement but not required for this task to avoid breaking the login flow
- RLS policies use `auth.uid()` from Supabase Auth; the custom `members` table's `id` (UUID) may or may not map to `auth.users.id` — role-based policies check the `role` column value directly as a fallback

## Acceptance Criteria

### AC-1: Script Creates Admin User on Clean Database
- **Type**: `rule`
- **Given**: Empty Supabase database with no prior Nexus Chat schema and valid `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in environment
- **When**: Script is executed with `NODE_ENV=local`
- **Then**: All 5 tables exist with correct columns; admin row exists in `members` with email='elonmuskite@gmail.com', role='supabase_admin', email_verified=true, member_id='1000000000'
- **Pass Condition**: Post-execution SQL query returns exactly 1 admin row matching all fields; script exits with code 0
- **Evidence**: Stdout of script run + SQL SELECT result from verification step

### AC-2: Idempotent Re-Execution
- **Type**: `rule`
- **Given**: Database with admin user already provisioned
- **When**: Script is executed 3 consecutive times
- **Then**: No new rows created; each run exits with code 0; `count(*)` of `supabase_admin` role remains exactly 1
- **Pass Condition**: Admin count stays 1 across all runs; exit code 0 each time
- **Evidence**: Three sequential script execution outputs; final count query result

### AC-3: RLS Blocks Non-Admin Access to Admin Record
- **Type**: `rule`
- **Given**: Database with admin user and a second regular member user (role='user')
- **When**: Regular member queries `members` table filtered to admin email via anon-key authenticated Supabase client
- **Then**: Query returns 0 rows (empty result set)
- **Pass Condition**: Anon-key SELECT for admin email returns []
- **Evidence**: Query output from anon client showing empty array

### AC-4: Unique Constraint Prevents Duplicate Admin Email
- **Type**: `rule`
- **Given**: Database with existing admin user at elonmuskite@gmail.com
- **When**: Attempted INSERT of second row with same email
- **Then**: INSERT fails with unique constraint violation; DB rejects the duplicate
- **Pass Condition**: SQL INSERT throws constraint error; members count for email remains 1
- **Evidence**: SQL error output + count query confirming no duplicate

### AC-5: Error Categories Distinguishable
- **Type**: `rule`
- **Given**: Script configured to trigger each error case
- **When**: Missing service role key, invalid DB URL, malformed admin email each tested separately
- **Then**: Each case exits with distinct non-zero code and message identifying the specific failure
- **Pass Condition**: Exit codes 1/2/3 observed for missing-env / connection / permission cases respectively
- **Evidence**: Three separate test runs with captured exit codes and stderr

### AC-6: Credential Format Validation
- **Type**: `rule`
- **Given**: ADMIN_EMAIL set to 'invalid-email' and ADMIN_PASSWORD set to 'weak'
- **When**: Script starts execution
- **Then**: Script exits before making any database calls with exit code 1 and messages explaining both validation failures
- **Pass Condition**: No network calls made; pre-validation exits with formatted error message
- **Evidence**: Stderr output listing both validation errors; script completes before Supabase client init

### AC-7: Environment Compatibility
- **Type**: `rubric`
- **Dimension**: Script runs correctly across configuration sources
- **Scale**: 1-5
- **Anchors**: 1 = Only works with hardcoded values; 3 = Works with env vars on one OS; 5 = Reads env vars, .env fallback, works on Windows PS + Linux bash, all env categories supported
- **Pass Threshold**: >= 4
- **Evidence**: Test on Windows with env vars; test with .env file; NODE_ENV=staging/production flags honored

### AC-8: Code Quality & Maintainability
- **Type**: `rubric`
- **Dimension**: Script structure, error clarity, and documentation
- **Scale**: 1-5
- **Anchors**: 1 = Spaghetti code, no comments, cryptic errors; 3 = Separated functions, basic comments, reasonable errors; 5 = Modular (config → validate → connect → migrate → provision → verify), action-oriented error messages with remediation hints, README-level usage notes in script header comment
- **Pass Threshold**: >= 4
- **Evidence**: Code inspection of final script files

## Open Questions
- [ ] None at this time — all requirements covered by functional specs above
