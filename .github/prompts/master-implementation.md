---
name: master-implementation
description: Standardized update workflow for Nexus Chat.
---

### MANDATORY PRE-IMPLEMENTATION STEPS:
1. **SYNC PROJECT_SUMMARY**: Read `PROJECT_SUMMARY.md`. Analyze the proposed feature and update the "Current Status" and "Main Experience Areas" in `PROJECT_SUMMARY.md` *before* touching source code.
2. **PLANNING**: State the technical approach. If the change involves mobile distribution, clearly define if it is an Android (Capacitor) or iOS (PWA/Web) update.
3. **IMPLEMENTATION**: 
   - Apply changes following the existing React/Vite/Tailwind patterns.
   - Use `import { Capacitor } from '@capacitor/core';` for any native-specific logic. 
   - Ensure `Capacitor.isNativePlatform()` guards are used for Android-specific code.
4. **VERIFICATION**: Provide the commands to:
   - Sync the build (`npm run build && npx cap sync`)
   - Test locally.
   - Push to GitHub.
5. **DEPLOYMENT**: Remind the user to commit and push to trigger Vercel deployment.

Rules:
- Never break the hybrid auth persistence (Supabase + localStorage).
- Maintain the PWA meta tags in `index.html` for iOS installation support.
- If Supabase schema changes are needed, add a new timestamped SQL migration under `supabase/migrations/`; never edit an applied migration or execute schema SQL from browser-facing code/build validation.
