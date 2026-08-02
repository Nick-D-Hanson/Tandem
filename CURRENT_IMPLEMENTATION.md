# Tandem Current Implementation

Last updated: August 2, 2026

Repository: `Nick-D-Hanson/Coupled`

Production: <https://coupled-indol.vercel.app>

## Purpose of this document

This is a self-contained description of the implemented Tandem MVP. It is intended to be pasted into a ChatGPT project or another planning context before designing future features.

This document describes current user-facing behavior and calls out dormant compatibility code separately. It intentionally contains no passwords, tokens, database URLs, or other secret values.

## Product summary

Tandem is a private shared calendar and task workspace for exactly two people. Both members have equal editing access to the shared workspace, calendar events, tasks, and categories.

The application currently provides:

- Account creation, sign-in, password reset, and session management through Neon Auth.
- One shared workspace per user, with a strict two-member maximum.
- Secure seven-day invitation links for adding the second member.
- Shared Month, Week, 3 Month, Future Events, and Agenda calendar views.
- Date-only single-day and multi-day Events.
- Custom recurring Events, including daily, weekly, monthly, annual, interval-based, selected-weekday, and optional-end-date definitions.
- Shared Tasks with optional due dates, assignees, categories, priorities, and notes.
- Task views for All incomplete, Inbox, Today, Upcoming, Completed, and individual categories.
- Task grouping by Category or Creator.
- Shared categories whose names and colors drive Tasks and supply the Event color when an Event is saved.
- Responsive desktop, tablet, and mobile layouts.
- Light and dark themes.

## Current technology stack

| Layer | Implementation |
| --- | --- |
| Web framework | Next.js 16.2 App Router |
| UI runtime | React 19.2 and TypeScript |
| Styling | Tailwind CSS 4, Radix UI primitives, shadcn-style local components |
| Icons and notifications | Lucide React and Sonner |
| Authentication | Neon Auth via `@neondatabase/auth` |
| Database | Neon Serverless Postgres |
| ORM and migrations | Drizzle ORM and Drizzle Kit |
| Validation | Zod |
| Date handling | date-fns and date-fns-tz |
| Unit tests | Vitest |
| Browser tests | Playwright |
| Hosting | Vercel |
| Package manager | pnpm 11 |

## High-level architecture

Tandem uses a server-first Next.js architecture:

1. A dynamic App Router page authenticates the request and loads all data for the user's workspace.
2. The server serializes a minimal `AppData` object containing the workspace, current user, members, categories, tasks, and events.
3. `TandemApp` owns interactive client state such as calendar mode, anchor date, task filter, responsive task-panel visibility, and item-editor state.
4. Every mutation runs through a server action.
5. Server actions re-authenticate the user, scope mutations to the active workspace, validate input, mutate Postgres, and revalidate `/app`.
6. The client calls `router.refresh()` after successful mutations to receive refreshed Server Component data without a full browser reload.

There is no separate public REST or GraphQL API for product data. Database access is server-only.

## Routes and navigation

### Public and authentication routes

- `/` redirects authenticated users to `/app` and other users to `/sign-in`.
- `/sign-in` provides Neon Auth sign-in.
- `/sign-up` provides Neon Auth account creation.
- `/forgot-password` starts password recovery.
- `/reset-password` completes password recovery.
- `/api/auth/[...path]` exposes the Neon Auth handler.
- `/invite/[token]` validates and accepts a workspace invitation.

### Authenticated routes

- `/onboarding` creates the first workspace for an authenticated user who has no membership.
- `/app` renders the shared calendar and task workspace.
- `/settings` manages the shared workspace, membership invitation, appearance, and sign-out.

The `/app` route supports `view` and `date` query parameters. Valid views are `today`, `month`, `week`, `quarter`, `events`, and `agenda`. Calendar navigation updates these parameters without scrolling, allowing the selected calendar period to survive navigation and refreshes.

## Authentication and authorization

### Identity

Neon Auth owns user identity and sessions. The application stores Neon Auth user IDs as text references in its public Postgres schema.

Runtime authentication requires:

- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`

### Workspace authorization

- Every protected read calls `requireUser()` or `requireWorkspace()`.
- Every item mutation filters by both item ID and active workspace ID.
- Category and assignee IDs are validated against the active workspace before saving.
- Cross-workspace resources return a generic not-found result rather than exposing their existence.
- A database unique index enforces that a user belongs to only one workspace.
- Both members are peers; there is no owner/admin permission distinction in the product UI.

## Workspace onboarding and invitations

### Workspace creation

An authenticated user without a workspace enters:

- Workspace name
- Their display name
- An IANA timezone, initially detected from the browser

Workspace creation is atomic and also creates the first membership plus three starter categories: Home, Work, and Errands.

### Invitations

- A workspace can contain no more than two members.
- Invite tokens are generated with cryptographically secure random bytes.
- Only a SHA-256 hash is stored in Postgres; the raw token exists only in the URL returned to the user.
- Invite links expire after seven days.
- Generating a new invite revokes all prior unused invites for that workspace.
- Invite URLs use the active browser origin, so local testing produces localhost links and production produces production links.
- Invite acceptance uses a row-locking SQL operation to prevent concurrent requests from creating a third membership.
- A signed-out recipient can sign in or create an account and then return to the invite.

## Workspace settings

The Settings screen contains:

- Workspace: change workspace name and IANA timezone.
- Members: view both equal members and generate/copy the second-member invite while a seat is open.
- Appearance: select light or dark mode for the current device and sign out.

Changing the workspace timezone changes how stored UTC instants are displayed. It does not rewrite stored timestamps.

## Application shell and responsive behavior

### Desktop above 1180 px

- Left navigation sidebar
- Center calendar
- Persistent right Tasks sidebar
- Each sidebar owns its collapse control, and compact edge rails restore hidden sidebars while keeping the center header unobscured.

### Tablet from 821 px through 1180 px

- Left navigation plus calendar
- Tasks can appear as a fixed right-side overlay
- The left sidebar owns its collapse control; a compact edge rail restores it. Tasks open below the center header as a fixed overlay and carry their own close control.

### Mobile at 820 px and below

- Calendar and Tasks are separate full-height surfaces.
- A bottom navigation bar switches between Calendar and Tasks and opens the add-item editor.
- Primary navigation opens in a left sheet.

Creating a new Task explicitly keeps or restores the Tasks screen/overlay while refreshed server data arrives. The task sidebar does not close after creation.

The keyboard shortcuts `N` and `C` open a new Task editor when focus is not inside a form control and no command modifier is pressed.

## Calendar implementation

### Views

The main header uses one compact selector for Today, Week, Month, and 3 Month. Today is a dedicated one-day view that returns to the current date in the workspace timezone. Events and Agenda remain separate, directly accessible buttons beside the selector.

#### Today

- Displays every Event and dated Task for the current workspace-local date in one readable list.
- Remains visibly rendered when the date is empty and offers a direct add-Event action.
- Previous and next controls browse one day at a time; selecting Today again returns to the actual current date.

#### Month

- Always renders a six-week, Sunday-through-Saturday grid.
- Displays up to three items in each date cell, followed by a `+N more` indicator.
- Clicking a date opens a new Event for that date.
- Clicking an item opens its editor.

#### Week

- Renders Sunday through Saturday.
- Includes an all-day row designed for the large number of date-only Items.
- All-day cards wrap long titles and display up to two lines of Event details or Task notes.
- All-day Items are ordered by creation timestamp, newest first.
- The all-day area grows vertically instead of forcing every Item into a single truncated line.
- Includes hourly rows from 7:00 AM through 8:00 PM for compatibility with timed legacy data.
- Current Event creation is date-only, so newly created Events appear in the all-day row.
- Day columns use constrained responsive sizing so long Items cannot overlap adjacent days when the available laptop width shrinks.

#### 3 Month

- Renders the selected month and the following two months in compact side-by-side calendars.
- Uses category-colored Event squares and Task circles to summarize up to five Items per date.
- Supports three-month previous and next navigation while preserving direct date selection.

#### Future Events

- Displays all future one-time Events without an arbitrary date-window cutoff.
- Includes an Event that is currently in progress across multiple dates.
- Displays the next occurrence of each recurring Event series, including indefinitely recurring series.
- Sorts Event cards by their next occurrence date and then by creation time.
- Shows date or date range, title, details, location, category, category color, and recurrence label.
- Does not include Tasks; this preserves a dedicated Event surface while Agenda remains available for mixed Items.

#### Agenda

- Examines an 18-day range beginning two days before the anchor date.
- Omits empty days except for the selected anchor date, so Today remains visible even when no Items are scheduled.
- Shows item type, category color, location for Events, and completion state for Tasks.

### Calendar item rendering

- Events and Tasks use their category color for the left border, tint, and color marker.
- Events without a category use slate gray.
- Tasks without a category use slate gray.
- Dated Tasks appear on the calendar.
- Undated Tasks do not appear on the calendar.
- Completed Tasks remain visible on the calendar with reduced opacity and a line-through.
- Multi-day Events render on every included calendar date.
- Recurring Event occurrences are calculated client-side from one stored master Event; occurrence rows are not materialized in the database.
- On laptop and desktop layouts, truncated calendar and task text exposes a hover preview with the full title, details, and relevant metadata before selection.

## Events

### Current Event fields

- Title, required
- Start date, required
- End date, required and not earlier than the start date
- Location, optional
- Category, optional
- Recurrence, optional
- Details, optional

### Date behavior

- Events are currently always all-day/date-only.
- Start Time and End Time are intentionally absent from the Event editor.
- Single-day Events use the same start and end date.
- Multi-day Events use inclusive dates in the UI.
- Postgres stores the all-day end boundary exclusively at midnight after the final included date.
- The server currently forces `allDay: true` regardless of legacy validation fields.

### Event categories and colors

- Events select a shared category by name with a colored circular preview.
- The Event stores both `list_id` and a copy of the category hex color.
- Changing an Event's category updates its calendar color.
- Recoloring a category does not currently rewrite the copied color on Events that were already saved; Tasks read the category color dynamically.
- Uncategorized Events use `#64748b`.
- Legacy named colors are normalized when rendered.

### Event recurrence

Available presets:

- Never
- Daily
- Weekly
- Monthly
- Annually
- Custom

Custom recurrence supports:

- Frequency: days, weeks, months, or years
- Interval from 1 through 99
- Selected weekdays for weekly recurrence
- Optional recurrence end date

The recurrence rule is stored as either a legacy simple frequency string or versioned JSON. The calendar calculates occurrences from the stored start date. Editing or deleting a recurring Event affects the entire stored series; per-occurrence exceptions are not implemented.

## Tasks

### Current Task fields

- Title, required
- Due date, optional
- Category, optional; no category means Inbox
- Assignee, optional; no assignee means unassigned/shared
- Priority: None, Low, Medium, or High
- Notes, optional

Due Time and Repeats are intentionally absent from the current Task editor.

### Task completion

- Checking a Task applies an immediate optimistic completion state.
- Successful completion shows a toast.
- Failures revert the optimistic state and show an error.
- Completed Tasks are excluded from All incomplete, Inbox, Today, Upcoming, and category views.
- Completed Tasks appear only in the Completed task bucket in the right sidebar.
- Reopening a completed Task returns it to incomplete views.

### Task filters

- All incomplete: every non-completed Task; this is the default filter.
- Inbox: incomplete Tasks without a category.
- Today: incomplete Tasks due today in the workspace timezone.
- Upcoming: incomplete Tasks due after today.
- Completed: completed Tasks only.
- Category filter: incomplete Tasks belonging to the selected shared category.

The left sidebar displays live counts for these views and for each category.

### Task grouping

The right Tasks sidebar supports two grouping modes:

1. Category, displayed first and selected by default.
2. Creator.

#### Category grouping

- Tasks are divided by shared category; uncategorized Tasks appear under Inbox.
- Category headers include the category color and total Task count.
- Each category initially displays only its single highest-urgency Task.
- Remaining Tasks are collapsed behind `Show N more` and can be expanded/collapsed independently.
- Expansion state is client-only and resets when the section remounts.

Urgency sorting is:

1. Overdue
2. Due today
3. Future due date
4. Undated
5. Completed

Within those tiers, earlier due timestamps sort first, then High/Medium/Low/None priority, then creation time.

#### Creator grouping

- Tasks are divided by the workspace member who created them.
- Creator filter chips can further limit the view to All creators or one member.
- Tasks from a former/unknown member are grouped separately if such data exists.
- Creator groups show all matching Tasks rather than using Category's collapsed presentation.

### Task visual treatment

- A Task card's left border and background tint use its category color.
- Category metadata includes a colored dot.
- Priority is shown as a labeled flag rather than a competing colored edge.
- The assignee is shown as an initial avatar when present.

### Dormant Task recurrence compatibility

The database schema, validation layer, recurrence parser, and completion action still understand recurring Tasks for legacy compatibility. If a stored recurring Task is completed and has a due date, completion advances it to the next occurrence instead of leaving it completed.

The current Task editor neither displays recurrence controls nor submits a recurrence definition. New recurring Tasks cannot currently be created through the UI, and future planning should treat Task recurrence as not implemented for users.

## Shared categories

The database table is still named `task_lists`, but the current product language and behavior treat these records as categories shared by Tasks and Events.

Members can:

- Create a category
- Rename a category
- Change a category's hex color
- Delete a category after confirmation

Category names are unique within a workspace. Deleting a category does not delete items: affected Tasks move to Inbox and affected Events become uncategorized through `ON DELETE SET NULL`. Because Events also store a color copy, a deleted category's Events retain that stored display color until they are edited and saved again.

## Data model

### `workspaces`

- UUID primary key
- Name
- IANA timezone
- Creator user ID
- Created/updated timestamps

### `workspace_members`

- UUID primary key
- Workspace UUID
- Neon Auth user ID
- Display name
- Optional avatar URL
- Joined timestamp
- Unique membership per workspace/user
- Globally unique user membership, enforcing one workspace per user

### `workspace_invites`

- UUID primary key
- Workspace UUID
- SHA-256 token hash
- Creator user ID
- Expiration timestamp
- Optional acceptance user/timestamp
- Optional revocation timestamp
- Creation timestamp

### `task_lists`

- UUID primary key
- Workspace UUID
- Unique workspace-scoped name
- Hex color
- Display position
- Created/updated timestamps

### `tasks`

- UUID primary key
- Workspace UUID
- Optional category UUID
- Title and notes
- Optional UTC due timestamp and all-day flag
- Optional assignee user ID
- Priority
- Optional completion timestamp
- Optional recurrence text for compatibility
- Position
- Creator/updater user IDs
- Created/updated timestamps

### `events`

- UUID primary key
- Workspace UUID
- Optional category UUID
- Title, description, and location
- UTC start and end timestamps
- All-day flag
- Hex or legacy color value
- Optional recurrence text
- Creator/updater user IDs
- Created/updated timestamps
- Database check requiring end after start

## Timezone strategy

- The workspace owns one IANA timezone shared by both members.
- Postgres stores timezone-aware UTC timestamps.
- `src/lib/dates/timezone.ts` centralizes local-date/UTC conversion.
- All-day conversions use local midnight and protect date identity across DST boundaries.
- Task view comparisons such as Today and Upcoming use the workspace timezone rather than the browser's independent timezone.

## Server actions and validation

Server actions exist for:

- Create/update/delete Task
- Toggle Task completion
- Create/update/delete Event
- Create/update/delete category
- Create workspace
- Create, inspect, and accept invitation
- Update workspace name/timezone

Zod validates IDs, lengths, ISO-style dates, optional text, priority, category colors, event date ordering, and recurrence bounds. Mutation errors return structured success/failure results and user-safe messages.

## Database migrations

Committed Drizzle migrations currently include:

- `0000_even_yellow_claw.sql`: initial workspace, membership, invite, category, Task, and Event schema.
- `0001_loud_hulk.sql`: Task recurrence compatibility column.
- `0002_last_star_brand.sql`: Event category relationship, index, and legacy color-based backfill.

Migrations are applied with `pnpm db:migrate` against `DATABASE_URL`. No database migration is required for the current collapsed Category task presentation because it is client-side UI behavior.

## Environment configuration

Required runtime variables:

- `DATABASE_URL`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`
- `NEXT_PUBLIC_APP_URL`

Optional seed variables:

- `SEED_USER_A_ID`
- `SEED_USER_B_ID`
- `SEED_USER_A_NAME`
- `SEED_USER_B_NAME`

Optional authenticated Playwright variables:

- `E2E_EMAIL`
- `E2E_PASSWORD`

Never place real values for these variables into planning documents, prompts, source code, or commits.

## Testing and quality gates

Current automated unit coverage includes:

- Two-member and cross-workspace authorization invariants
- Workspace timezone and DST-safe all-day conversion
- Month and week date ranges
- Production-versus-local invite URL construction
- Annual and custom recurrence behavior
- Recurrence serialization and end dates
- Event, Task, workspace, and category validation
- Multi-day Event validation

The current Vitest suite contains 19 passing tests across five test files.

A Playwright happy-path test covers authenticated Task and Event creation. It is skipped unless dedicated `E2E_EMAIL` and `E2E_PASSWORD` values are present; there is no authentication bypass.

Standard release validation is:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Major UI changes are additionally verified in the local in-app browser before commit/deployment.

## Deployment

- Source control: private GitHub repository on `main`.
- Hosting: linked Vercel project.
- Production alias: <https://coupled-indol.vercel.app>
- Framework detection: Next.js.
- Production deployment is performed after local approval with an explicit Vercel production deployment and READY-state confirmation.
- Database migrations are separate from application deployment and are run automatically by the development agent only when a schema change requires them and the user approves execution.

## Important current constraints and planning gaps

These are not necessarily defects; they define the current MVP boundary:

- Exactly two members; no third seats, roles, ownership transfer, or member removal flow.
- One workspace membership per user.
- No Google Calendar, Apple Calendar, Outlook, or CalDAV synchronization.
- No reminders, push notifications, email notifications, or digest system.
- No Task recurrence controls in the current UI.
- No timed Event creation in the current UI.
- No per-occurrence editing, skipping, or exception dates for recurring Events.
- The Future Events view shows one next occurrence per recurring series rather than expanding an infinite list of future occurrences.
- No drag-and-drop rescheduling or manual Task reordering.
- No attachments, comments, activity feed, or audit-log UI.
- No search or global command palette.
- No offline mode or real-time push subscription; freshness comes from Server Action revalidation and router refreshes.
- All workspace Tasks and Events are loaded on each app request; there is no pagination or date-window query optimization yet.
- Category/Creator selection, creator chip selection, and category expansion state are not persisted between remounts or devices.
- Existing Event color copies are not automatically synchronized when a category is recolored or deleted.
- Product data does not use Postgres row-level security because database access is exclusively server-side.
- Distributed invite rate limiting, structured monitoring, and full audit logging remain hardening follow-ups.
- Authenticated end-to-end testing is not yet wired to an isolated preview database in CI.

## Key source map

| Concern | Primary file |
| --- | --- |
| Main authenticated page | `src/app/(product)/app/page.tsx` |
| Interactive app shell | `src/components/app-shell/tandem-app.tsx` |
| Left navigation | `src/components/app-shell/app-sidebar.tsx` |
| Calendar rendering | `src/components/calendar/calendar-view.tsx` |
| Event/Task editor | `src/components/item-editor/item-editor.tsx` |
| Tasks sidebar | `src/components/tasks/task-panel.tsx` |
| Workspace settings | `src/components/settings/settings-form.tsx` |
| Onboarding | `src/components/onboarding/onboarding-form.tsx` |
| Invite flow | `src/components/invite/invite-card.tsx` and `src/app/invite/[token]/page.tsx` |
| Application data loader | `src/lib/data/app-data.ts` |
| Item/category actions | `src/lib/actions/items.ts` |
| Workspace/invite actions | `src/lib/actions/workspace.ts` |
| Authorization | `src/lib/authorization/index.ts` |
| Database client | `src/lib/db/client.ts` |
| Database schema | `db/schema.ts` |
| Database migrations | `db/migrations/` |
| Validation schemas | `src/lib/validation/schemas.ts` |
| Timezone utilities | `src/lib/dates/timezone.ts` |
| Recurrence engine | `src/lib/recurrence.ts` |
| Shared serialized types | `src/lib/types.ts` |

## Suggested context statement for future planning

When planning future Tandem work, assume the application is a deployed two-person shared workspace with secure Neon Auth membership, date-only recurring/multi-day Events, dedicated Month/Week/Future Events/Agenda surfaces, optional-date non-recurring Tasks, shared color-coded categories, Category-first collapsed urgency task grouping, and independently collapsible desktop sidebars. Preserve workspace scoping, the two-member invariant, category color consistency, timezone correctness, local-first testing, and the user's approval-before-deployment workflow.
