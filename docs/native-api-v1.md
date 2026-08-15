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

## Planned compatible additions

Later phases add bounded calendar, Task, category, My List, Activity, widget-snapshot, mutation, device-push, and settings endpoints. Each route must authenticate, derive workspace membership server-side, validate inputs/outputs, apply existing domain rules, and avoid revealing cross-workspace resource existence.
