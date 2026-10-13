# Project: Nexus Chat

## Overview
Nexus Chat is a modern messaging and community experience built with React, Vite, Tailwind CSS, and a Supabase-ready persistence layer. The app now combines a polished landing experience, secure member authentication, a protected chat shell, and a private messaging hub.

## Current Status (2026-07-14)
- ✅ Reworked the app from a mock preview into a branded multi-page experience
- ✅ Added a public landing page with animated branding, theme switching, and stronger download CTA elements
- ✅ Implemented polished auth routes for login, registration, password recovery, and reset flows
- ✅ Added member-based signup and sign-in with a unique member number and password
- ✅ Wired authentication to a Supabase-backed member store with localStorage fallback
- ✅ Added chat-shell routing under /app and protected access for the main experience
- ✅ Added wallpaper customization and settings support in the chat experience
- ✅ Added voice-call and end-to-end-encryption scaffolding for future expansion
- ✅ Introduced a shared auth header experience across login, register, forgot-password, and reset-password pages
- ✅ Updated landing page and auth copy to emphasize privacy-first, end-to-end encrypted messaging
- ✅ Added a protected admin dashboard route under /admin with role-based access control
- ✅ Added premium-style incoming notification popups for chat activity with avatar previews and auto-dismiss timing
- ✅ Switched the landing download area from the old GitHub link to Android/iOS app download CTA buttons
- ✅ Updated Android download flow to use a hosted APK on Vercel for Android web users
- ✅ Removed legacy investment page and purged the /invest route from source
- ✅ Added brand-wiggle and brand-pulse animations for the logo
- ✅ Fixed conflicting brand-spin class in Header.jsx
- ✅ Unified theme management system: now using useTheme.js across the entire app
- ✅ Updated ChatSidebar and ChatLayout to use the unified theme system
- ✅ Added all requested font families (Poppins, Roboto, Open Sans, Courier New) to Tailwind config
- ✅ Applied font-poppins as the default body font
- ✅ Set up theme-aware color system in index.css
- ✅ Removed next.config.ts to prevent Vercel from misdetecting project as Next.js
- ✅ Added nexus-chat-tmp to gitignore
- ✅ Added "oily blue" gradient style to Nexus wording
- ✅ Added Corel Draw-style artistic text effects (bold weight, letter spacing, text shadow)
- ✅ Ensured all components use the unified theme system

## Main Experience Areas
- Landing and auth: [src/pages/AuthLanding.jsx](src/pages/AuthLanding.jsx), [src/pages/Login.jsx](src/pages/Login.jsx), [src/pages/Register.jsx](src/pages/Register.jsx), [src/pages/ForgotPassword.jsx](src/pages/ForgotPassword.jsx), [src/pages/ResetPassword.jsx](src/pages/ResetPassword.jsx), [src/components/AuthShell.jsx](src/components/AuthShell.jsx)
- App routing and protection: [src/App.jsx](src/App.jsx), [src/components/ProtectedRoute.jsx](src/components/ProtectedRoute.jsx)
- Auth state and persistence: [src/lib/AuthContext.jsx](src/lib/AuthContext.jsx), [src/lib/supabase.ts](src/lib/supabase.ts)
- Chat UI and layout: [src/layouts/ChatLayout.jsx](src/layouts/ChatLayout.jsx), [src/pages/ChatPage.jsx](src/pages/ChatPage.jsx), [src/components/chat/ChatView.jsx](src/components/chat/ChatView.jsx), [src/components/chat/NotificationStack.jsx](src/components/chat/NotificationStack.jsx)
- Visual system and branding: [src/index.css](src/index.css), [index.html](index.html), [public/manifest.webmanifest](public/manifest.webmanifest)

## Key Implementation Notes
- The app uses a hybrid persistence strategy: Supabase is the preferred backend for member accounts, while localStorage remains a fallback for local development and offline resilience.
- The theme system is persistent via localStorage and applies across the public and authenticated experience.
- The UI uses CSS-driven animations instead of package-heavy motion libraries for stability.
- Supabase schema is maintained as versioned migrations under [supabase/migrations](supabase/migrations); database changes are applied only with the explicit operator CLI, never during a web build.

## Current Feature Set
- Secure member registration with automatically generated member number
- Password-protected sign-in flow for returning users
- Protected chat area with responsive layout and chat panels
- Shared auth-shell header experience across public auth pages
- Premium-style incoming notification popups for messages and attachments
- Download options for Android, PC, Tablet, Mac, and iPhone through the landing page CTA section
- Wallpapers, settings, and profile-oriented chat customization

## Notes: UI & Formatting Updates
- Header: Replaced duplicated header markup with a shared `Header` component used across `AuthLanding.jsx`, `Login.jsx`, and `Register.jsx`. The same persistent branded header now appears on all auth pages, preserves current animations, and keeps the existing `Capacitor.isNativePlatform()` native platform guard.
- Brand logo animation: The `Header` logo now chooses a random animation style on each load and keeps that branded effect consistent across all public and auth routes.
- Nexus ID formatting: Nexus numbers are now rendered for display using the `10-XXXX-XXXX` pattern (e.g. `10-1234-5678`). The formatter is implemented in `src/lib/AuthContext.jsx` as `formatNexusIdForDisplay` and stored in session objects as `nexusIdDisplay` for UI rendering.
- Custom Nexus Number Input: Implemented `src/components/NexusNumberInput.jsx` that auto-formats the input as the user types and uses a mobile-optimized numeric keyboard.
- Multi-font Support: Added Google Fonts (Inter, Poppins, Roboto, Open Sans) and utility classes for easy font switching.
- Android APK hosting: The Android download button on the landing page will download `https://nexus-chat-sandy-alpha.vercel.app/app-release.apk` for Android web users (uses the `download` attribute).

## Next Priorities
- Verify the full auth and persistence flow in the browser
- Confirm Supabase table access and policies in the connected project
- Polish any remaining UI details and expand feature completeness across chat actions
