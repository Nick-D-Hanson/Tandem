# Tandem

Tandem is a production-minded two-person shared calendar and task workspace built with Next.js App Router, Neon Auth, Neon Postgres, Drizzle, Tailwind CSS, and shadcn/ui.

## Product scope

- Exactly two equal workspace members, with hashed seven-day invite links.
- Shared Month, Week, and Agenda calendar views.
- Timed/all-day/recurring events with locations, descriptions, and categories.
- Inbox, Today, Upcoming, Completed, and custom shared task lists.
- Dated tasks appear in both the calendar and task agenda; undated tasks stay in Inbox or a list.
- Responsive three-column desktop layout, tablet task overlay, and mobile calendar/task surfaces.
- Light/dark themes, keyboard quick add (`N` or `C`), accessible dialogs, confirmations, and toasts.

## Local setup

Prerequisites: Node.js 20+ and pnpm 11.

1. Create a Neon project and enable Neon Auth for its primary branch.
2. Copy `.env.example` to `.env.local` and set:
   - `DATABASE_URL`: pooled Neon Postgres connection string.
   - `NEON_AUTH_BASE_URL`: the Neon Auth URL returned by Neon provisioning, including `/auth`.
   - `NEON_AUTH_COOKIE_SECRET`: stable random value of at least 32 characters.
   - `NEXT_PUBLIC_APP_URL`: `http://localhost:3000` locally and the canonical URL in production.
3. Install and initialize:

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), create an account through Neon Auth, then create the first workspace. The app returns a private link for the second user.

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
- Neon HTTP + Drizzle handles server-only database access. Invite acceptance uses one row-locking SQL statement so concurrent requests cannot create a third member.
- UTC instants are stored in Postgres. `src/lib/dates/timezone.ts` centralizes conversion to and from the workspace IANA timezone, including all-day dates.
- View state stays client-side and durable calendar state is reflected in `view` and `date` URL parameters.

## Vercel deployment

Import the repository into Vercel, set all four runtime environment variables from `.env.example`, and ensure `NEXT_PUBLIC_APP_URL` matches the production domain. Add that domain to the Neon Auth allowed origins, run `pnpm db:migrate` against the intended production branch, and deploy with the standard Next.js preset.

## Intentional production hardening follow-ups

- Add distributed rate limiting for invitation generation and acceptance.
- Add structured error monitoring and audit logging without secrets or raw invite tokens.
- Run Playwright against an isolated Neon preview branch in CI with dedicated auth identities.
- Add database-level RLS if the product later exposes the Neon Data API directly; the MVP keeps all database access server-side.
