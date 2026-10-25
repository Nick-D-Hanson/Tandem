# Native iOS migration baseline

Date: 2026-08-15  
Web repository: `/Users/nick/Documents/Coupled`  
Web branch: `feature/native-client-api-v1`  
Native repository: `/Users/nick/Documents/Coupled-iOS` (independent Git repository)  
User-facing product name: **Tandem**

## Repository state and isolation

- The web worktree was clean on `main` before migration work began (`## main...origin/main`).
- No pre-existing user changes were present or discarded.
- The local branch `feature/native-client-api-v1` was created; it has not been pushed.
- `/Users/nick/Documents/Coupled-iOS` did not previously exist. It was created as an empty sibling directory and initialized with its own `.git` directory and no remote.
- The web/PWA remains the canonical production application. The native repository will be a client of an authenticated `/api/v1` surface and will never import the web database layer or connect directly to Neon.

## Current technical baseline

- Next.js 16.2.12 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4, and pnpm 11.18.0.
- Neon Auth `@neondatabase/auth` 0.4.2-beta and `@neondatabase/auth-ui` 0.2.1-beta. The lockfile resolves Better Auth 1.4.18 underneath the Neon packages.
- Neon Serverless 1.1.x, Drizzle ORM 0.45.x, Drizzle Kit 0.31.x, Zod 4.4.x, date-fns 4.4.x, and date-fns-tz 3.2.x.
- Vitest 4.1.x, Playwright 1.62.x, ESLint 9, and Next.js production build checks.
- Vercel cron invokes the daily activity digest at 00:00 and 01:00 UTC so the server can select the 7:00 PM America/Chicago invocation across daylight-saving changes.

## Current implemented product behavior

- Neon Auth sign-up, sign-in, sign-out, forgot-password, reset-password, session middleware, and protected product routes.
- One workspace membership per user with an enforced two-member workspace limit.
- Shared workspace settings, members, secure hashed invitation tokens, categories, Tasks, Events, and recurrence.
- Month, week, today, quarter, upcoming-events, and agenda-style calendar presentations.
- Date-only/all-day and timed Event handling, including multi-day Event display and recurring calculated occurrences.
- Optional-date Tasks with category, assignee, priority, completion/reopen, recurrence, notes, and creator/updater metadata.
- Canonical Activity Summary with actor and item snapshots, creation/deletion/completion/reopen/update events, tracked date/category/priority/assignee changes, per-member read/clear state, and cursor pagination.
- Web Push subscription management and an idempotent daily 7:00 PM America/Chicago activity digest that excludes the recipient's own activity and uses privacy-preserving notification copy.
- PWA manifest, service-worker registration, push handling, safe same-origin notification navigation, and a Tandem icon.

Not currently implemented:

- A versioned native-client API beyond the Neon Auth catch-all route and the internal cron route.
- Calendar Task/Event drag-to-date behavior.
- Native push-token registration/delivery, Expo/WidgetKit widgets, or native deep links.

## Current authentication model

- `createNeonAuth` is configured server-side using `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`.
- Web sessions are read from Neon Auth via `auth.getSession()` and refreshed by the Next.js proxy middleware.
- The application resolves the authenticated user first and then loads that user's sole `workspace_members` record; client input does not select authoritative workspace membership.
- Scoped resource queries include the authorized workspace. Cross-workspace access is intentionally returned as `NOT_FOUND`.
- Native compatibility is unproven. The installed Neon Auth beta package must be checked against current official Neon/Better Auth Expo documentation before any production-data native auth or writes are claimed.

## Current schema

The Drizzle schema and committed migrations define:

- `workspaces`, `workspace_members`, and `workspace_invites`.
- `task_lists` (user-facing categories), `tasks`, and `events`.
- `activity_events` and `activity_read_states` for the shared activity ledger and private read/clear watermarks.
- `push_subscriptions`, `activity_digests`, and `activity_digest_deliveries` for Web Push and idempotent digest delivery.

Important invariants include one workspace membership per user, at most two members enforced in server logic, workspace-scoped indexes, immutable activity item snapshots, and one digest/delivery record per recipient/device/day combination.

## Current mutation architecture

- The web UI calls `"use server"` actions in `src/lib/actions`.
- Task/Event/category mutations validate Zod inputs, derive the workspace from the session, and use Drizzle transactions where item changes and Activity Summary writes must be atomic.
- Workspace and invite actions preserve token hashing, expiry, membership scoping, and the two-member invariant.
- Push actions scope subscription inspection/upsert/removal to the authenticated workspace/user.
- Native route handlers should call extracted server-only domain services, not UI-specific server actions. Initial extraction should be incremental so the web action behavior stays unchanged.

## Current read and API surface

- `getAppData()` loads the current workspace, members, all categories, all Tasks, and all Events. It is workspace-scoped but currently unbounded.
- `getActivityPage()` provides bounded cursor pagination and per-member read/clear semantics.
- Existing HTTP routes are `/api/auth/[...path]` and `/api/cron/activity-digest` only.
- The native API will add stable Zod DTOs and JSON envelopes under `/api/v1`, with date-window and page-size bounds and no raw database rows.

## PWA and push status

- The manifest identifies **Tandem Shared Planner**, starts at `/app/my-list`, and uses standalone display mode.
- `public/sw.js` shows privacy-preserving daily activity summaries, reuses a stable notification tag, validates same-origin destinations, and focuses an existing Tandem window before opening a new one.
- Web delivery uses VAPID-backed browser subscriptions. Native delivery must use a separate Expo/APNs device-token adapter while sharing the digest selection/idempotency layer.

## Pre-change quality gates

The global Corepack 0.30.0 installation could not verify the current pnpm registry signing key. Baseline commands were therefore rerun through the already-installed repository-local pnpm 11.18.0 binary; no dependencies or source files were changed.

- `./node_modules/.bin/pnpm typecheck` -> PASS, exit 0, no TypeScript errors.
- `./node_modules/.bin/pnpm lint` -> PASS, exit 0, no ESLint errors.
- `./node_modules/.bin/pnpm test` -> PASS, exit 0, 18 test files and 97 tests passed in 3.24s. Vitest emitted one existing future config-loader warning about ESM syntax in `vitest.config.ts`.
- `./node_modules/.bin/pnpm build` -> PASS, exit 0, Next.js 16.2.12 compiled in 3.6s, TypeScript completed in 4.3s, and 5/5 static pages generated.

The first sandboxed build attempt failed because Turbopack was not permitted to bind an internal local port. The same unchanged build passed outside that sandbox restriction; this is an execution-environment limitation, not a repository baseline failure.

## Cross-repository boundary

```text
Coupled-iOS (Expo/React Native)
  -> authenticated HTTPS JSON /api/v1
Coupled (Next.js backend and stable web/PWA)
  -> existing authorization and domain services
Neon Postgres (canonical data model)
```

The web repository owns API DTO schemas, authentication enforcement, workspace authorization, business rules, migrations, Activity Summary, digest selection, and all database access. The native repository owns native navigation, screens, secure session persistence, client-side caching, gestures, push permission/device registration, widget snapshots, WidgetKit-backed presentation, and deep-link handling.

## Detected risks

1. **Authentication compatibility (hard gate):** `@neondatabase/auth` is a beta package, and the current cookie/session integration is Next.js-specific. Supported Expo session persistence and native trusted origins must be proven from current official documentation and package exports.
2. **Unbounded legacy read model:** `getAppData()` loads all workspace Tasks and Events. Native calendar endpoints need explicit date windows and task limits without regressing the web view.
3. **Transport/domain coupling:** current mutations are server actions. Reusable server-only services must be extracted carefully so API handlers do not inherit UI request-context behavior.
4. **Calendar date semantics:** all-day Event end timestamps use an exclusive boundary while product duration is inclusive by local date. Move-date services must preserve spans across DST and reject calculated recurring occurrences.
5. **Push channel separation:** browser VAPID subscriptions cannot be reused for native push. The digest core is reusable, while device registration and delivery records need a compatible extension.
6. **Widgets/signing:** Expo Widgets requires a compatible Expo SDK, a development build, an App Group, a widget extension identifier, and eventually Apple signing credentials. Physical-device validation is expected to remain external.
7. **Sibling write permissions:** the current execution sandbox treats the sibling repository as outside the web workspace root, so native repository writes may require explicit filesystem approval even though the directory is user-requested.
8. **Contract drift:** native types must be generated or deterministically checked against canonical web Zod DTOs; copying ad-hoc TypeScript types would create silent drift.
9. **No safe local production proof:** no production database migration, deployment, push send, Apple signing, TestFlight upload, or App Store submission is authorized by this migration.
