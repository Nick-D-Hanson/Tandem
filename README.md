# Tandem

Tandem is a production-minded shared calendar and task workspace for couples, families, and groups, built with Next.js App Router, Neon Auth, Neon Postgres, Drizzle, Tailwind CSS, and shadcn/ui.

## Product scope

- One-to-many equal workspace members, with hashed, single-use seven-day invite links.
- Shared Month, Week, and Agenda calendar views.
- Timed/all-day/recurring events with locations, descriptions, and categories.
- Inbox, Today, Upcoming, Completed, and custom shared task lists.
- Dated tasks appear in both the calendar and task agenda; undated tasks stay in Inbox or a list.
- Responsive three-column desktop layout, tablet task overlay, and mobile calendar/task surfaces.
- Light/dark themes, keyboard quick add (`N` or `C`), accessible dialogs, confirmations, and toasts.
- An in-app Activity Summary for relevant Task/Event changes, with private per-member read state and an optional daily Web Push digest.

## Local setup

Prerequisites: Node.js 22.13+ and pnpm 11.

1. Create a Neon project and enable Neon Auth for its primary branch.
2. Copy `.env.example` to `.env.local` and set:
   - `DATABASE_URL`: pooled Neon Postgres connection string.
   - `NEON_AUTH_BASE_URL`: the Neon Auth URL returned by Neon provisioning, including `/auth`.
   - `NEON_AUTH_COOKIE_SECRET`: stable random value of at least 32 characters.
   - `NEXT_PUBLIC_APP_URL`: `http://localhost:3000` locally and the canonical URL in production.
   - Push is optional. To enable it, also set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `CRON_SECRET` as described below.
3. Install and initialize:

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), create an account through Neon Auth, then create the first workspace. The app returns a private link for the next member; additional members can be invited sequentially from Settings.

## Database workflow

The schema is in `db/schema.ts`; generated SQL and Drizzle metadata are committed in `db/migrations/`.

```bash
pnpm db:generate   # generate SQL after schema changes
pnpm db:migrate    # apply pending migrations to DATABASE_URL
pnpm db:seed       # optional demo data
```

Seeding requires `SEED_USER_A_ID` and `SEED_USER_B_ID` from Neon Auth. Names can be overridden with `SEED_USER_A_NAME` and `SEED_USER_B_NAME`. The seed is intentionally not automatic because it attaches demo workspace membership to real auth identities.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The Playwright happy path requires `E2E_EMAIL` and `E2E_PASSWORD` for a Neon Auth user who already belongs to a test workspace. Without them, the test is explicitly skipped rather than using an authentication bypass.

## Architecture

- Server Components load the authenticated workspace and serialize only the data needed by the interactive shell.
- Server Actions own every mutation and re-check authentication, active workspace membership, item ownership, assignees, list IDs, dates, and recurrence values with shared Zod schemas.
- Neon Auth owns identities. Application membership references its user IDs as text and keeps product data in the public schema.
- Neon HTTP + Drizzle handles server-only database access. Invite acceptance uses one row-locking SQL statement and each invite can be accepted only once.
- UTC instants are stored in Postgres. `src/lib/dates/timezone.ts` centralizes conversion to and from the workspace IANA timezone, including all-day dates.
- View state stays client-side and durable calendar state is reflected in `view` and `date` URL parameters.

## Activity Summary

The bell in the Calendar and My List headers opens `Activity Summary`. It loads the newest 50 entries separately from normal app data, supports cursor-based pagination, and groups entries by workspace-local day. A member sees both their own and other members' changes, but only other-member activity increases that member's private unread count. Opening the panel advances a timestamp-and-ID watermark only to the newest accessible event.

Tracked Task actions are create, complete, reopen, remove, and changes to due date, category, priority, or assignee. Tracked Event actions are create, remove, and changes to date/range or category. A save with multiple tracked changes produces one combined entry. Title-, notes-, description-, location-, color-, and recurrence-only edits are not tracked; My List items, categories, workspace settings, and invitations are also outside this activity ledger. Stored title, actor, date, category, assignee, and priority snapshots keep deleted-item history readable.

## Optional daily Web Push

Activity Summary contains the device-level `Enable daily summary` control. Permission is requested only from that button. Unsupported browsers get a non-blocking explanation; on iPhone/iPad, Tandem must first be added to the Home Screen and opened in standalone mode. Disabling affects only the current browser subscription. There are no immediate or per-event pushes.

When configured, production Vercel Cron invokes `/api/cron/activity-digest` at both `0 0 * * *` and `0 1 * * *` UTC. The authenticated route proceeds only when the current `America/Chicago` hour is 19, so one trigger covers CDT and the other covers CST. Its daily window is the previous Central date at 7:00 PM through the current Central date at 7:00 PM; timezone conversion handles 23-hour and 25-hour DST windows. No notification is sent when there is no other-member activity.

Digest and per-subscription delivery rows enforce one recipient digest per Central date and one delivery per device. Successful pairs are never claimed again, failed deliveries can be retried by explicitly rerunning the route, and 404/410 endpoints are disabled. The lock-screen body contains aggregate counts and actor names, never Task/Event titles or detailed changes. Notification clicks focus an existing Tandem window when possible and open Activity Summary.

Generate VAPID keys locally without committing their values:

```bash
pnpm exec web-push generate-vapid-keys
```

Configure:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: generated public key; intentionally available to the browser.
- `VAPID_PRIVATE_KEY`: matching server-only private key.
- `VAPID_SUBJECT`: a contact URI such as `mailto:admin@example.com`.
- `CRON_SECRET`: a high-entropy value Vercel sends as `Authorization: Bearer …`.

For manual testing, use HTTPS (or localhost where supported), open Activity Summary, click the enable control, confirm a `push_subscriptions` row is stored, then disable the device and confirm it is inactive. Push delivery itself should be tested with an approved HTTPS deployment and a supported device; iOS testing specifically requires a Home Screen installation. Activity Summary remains fully functional when any Push variable is absent.

## Vercel deployment

Import the repository into Vercel, set the required database/auth/application environment variables from `.env.example`, and ensure `NEXT_PUBLIC_APP_URL` matches the production domain. Add that domain to the Neon Auth allowed origins. Set the four optional Push variables above to enable the daily digest, run `pnpm db:migrate` against the intended production branch, and deploy with the standard Next.js preset. The two production cron schedules are declared in `vercel.json`; preview deployments do not run Vercel Cron.

## Intentional production hardening follow-ups

- Add distributed rate limiting for invitation generation and acceptance.
- Add structured error monitoring and audit logging without secrets or raw invite tokens.
- Run Playwright against an isolated Neon preview branch in CI with dedicated auth identities.
- Add database-level RLS if the product later exposes the Neon Data API directly; the MVP keeps all database access server-side.

Current Activity/Push limitations are intentional: no real-time notifications, configurable delivery time, granular notification filters, email/SMS, broad offline caching, Activity search/comments/exports, or notification settings in Workspace Settings. A process interruption after a push provider accepts a message but before its durable `sent` update can conservatively leave that delivery in `processing`; it will not be automatically retried to avoid a duplicate lock-screen notification.
