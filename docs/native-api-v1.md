# Tandem native API v1

The native API is an additive transport for the separate Expo client. Tandem's existing Server Components and server actions remain unchanged. All database access, workspace resolution, authorization, and business rules continue to run in the Next.js backend.

## Conventions

- Base path: `/api/v1`
- Media type: `application/json`
- Authentication: the existing Neon Auth session infrastructure
- Cache policy for member data: `private, no-store`
- Version response header: `X-Tandem-Api-Version: v1`
- Date-only values: `YYYY-MM-DD`
- Timestamps: ISO 8601 with an explicit offset
- Breaking changes require a new API version; compatible fields/endpoints may be added to v1.

Success envelope:

```json
{ "ok": true, "data": {} }
```

Failure envelope:

```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication is required."
  }
}
```

Failure messages are user-safe. Foreign resources are reported as generic `NOT_FOUND`, and unexpected server/database details are never serialized.

## Canonical contract

Zod schemas in `src/lib/api/v1/contracts.ts` are the source of truth. `pnpm api:contract` deterministically generates `contracts/native-api-v1.json`; `pnpm api:contract:check` fails when the checked artifact is stale. The native repository consumes and tests this artifact rather than maintaining unrelated handwritten DTOs.

## GET `/api/v1/me`

Returns the authenticated user's identity, their server-derived workspace, and the bounded one-or-two-member summary. The request does not accept a workspace ID.

Response data fields:

- `apiVersion`
- `generatedAt`
- `user`: `id`, `email`, `displayName`, `avatarUrl`
- `workspace`: `id`, `name`, `timezone`
- `members`: at most two entries with `userId`, `displayName`, `avatarUrl`

It intentionally omits database audit columns, invite tokens, auth cookies, secrets, and internal Neon fields.

Possible statuses:

- `200`: current identity/workspace returned
- `401`: no valid session
- `404`: no authorized workspace/resource
- `500`: generic server error

## Bounded read endpoints

All routes authenticate and derive the workspace from membership; none accepts a client workspace ID.

| Endpoint | Bounds |
| --- | --- |
| `GET /api/v1/categories` | 100 ordered categories maximum |
| `GET /api/v1/tasks?limit=50&before=<timestamp>` | Cursor page, 1–100 Tasks |
| `GET /api/v1/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD` | Inclusive workspace-local window, maximum 93 days and 500 Task/Event masters each |
| `GET /api/v1/my-list` | Existing authorization policy; at most two owners and yesterday plus three current/future days |
| `GET /api/v1/activity?cursorOccurredAt=<timestamp>&cursorId=<uuid>` | Existing cursor semantics, 50 Activity entries per page |

Calendar timestamps are derived from date-only parameters using the workspace timezone. Recurring masters are included so the client can use the same recurrence rules; calculated recurring occurrences remain read-only.

## Narrow date and rollover mutations

| Endpoint | Rule |
| --- | --- |
| `POST /api/v1/my-list/rollover` | Owner-only; atomically appends all yesterday rows after today's rows, preserves IDs/order, normalizes positions |
| `PATCH /api/v1/tasks/:id/move-date` | Accepts only `{ "targetDate": "YYYY-MM-DD" }`; preserves every non-date Task field and the local due time when present |
| `PATCH /api/v1/events/:id/move-date` | Accepts only the target date; shifts both endpoints by the same calendar-day delta and preserves an all-day inclusive span |

All mutation resources are re-fetched with the server-derived workspace inside a transaction. Date moves write through the canonical Activity Summary builder exactly once. Recurring Events return `409 CONFLICT` because the current data model has no occurrence exceptions.

Future compatible additions may add full CRUD, widget snapshots, native device push, and settings endpoints. Each must preserve the same authentication, output validation, safe-error, and cross-workspace non-disclosure rules.
