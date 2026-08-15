# Native authentication threat model

Date reviewed: 2026-08-15  
Status: **production native authentication blocked at the Phase 2 hard gate**

## Decision

The current Tandem Neon Auth deployment cannot be claimed as safely compatible with an Expo native client through the officially documented Better Auth Expo mechanism.

The web application uses:

- `@neondatabase/auth` `0.4.2-beta`
- `@neondatabase/auth-ui` `0.2.1-beta`
- Better Auth `1.4.18` transitively
- Next.js `createNeonAuth({ baseUrl, cookies })`
- managed Neon Auth server endpoints and signed HTTP-only/session-data cookies

The installed `@neondatabase/auth` package exposes Next.js, React, and vanilla adapters but no Expo adapter. Its Next.js server configuration type accepts only the managed Auth base URL, cookie configuration, and logging; it has no server plugin or `trustedOrigins` configuration surface.

Current Better Auth Expo documentation requires both:

1. the `@better-auth/expo` **server plugin** added to the Better Auth server; and
2. the Expo client plugin using `expo-secure-store`, an application scheme, and a corresponding trusted origin.

Current Neon guidance says Neon Auth is a managed Better Auth server and is not a drop-in self-hosted Better Auth instance; custom Better Auth server plugins/handlers are not currently supported. That conflicts directly with the documented Expo integration prerequisite.

References reviewed:

- https://better-auth.com/docs/integrations/expo
- https://neon.com/blog/neon-auth-branchable-identity-in-your-database
- https://neon.com/docs/changelog/2026-01-30
- https://docs.expo.dev/develop/authentication/
- https://docs.expo.dev/linking/into-your-app/

No custom bearer token, manually replayed cookie, second user system, direct database connection, or weakened origin/CSRF behavior will be introduced to bypass this gap.

## Safe path to unblock

Production native authentication can proceed when one of these supported conditions is explicitly available and verified:

1. Neon Auth documents and ships first-class Expo/React Native session support for the managed service, including secure cookie/session persistence and trusted native schemes.
2. Neon Auth permits/configures the required Better Auth Expo server plugin and native trusted origins for this branch through a supported SDK or Neon Console workflow.
3. A future `@neondatabase/auth` release exports a documented native adapter whose session credentials the existing Next.js backend can validate without a custom token bridge.
4. The user explicitly approves a separately reviewed authentication architecture change. This migration does not make that change automatically and does not replace Neon Auth.

Until then, the native repository may implement a mock/contract-driven shell, screens, DTO validation, deep-link validation, cache behavior, widget transformations, and other credential-independent work. Any real `/api/v1/me` call, production data read/write, push registration, or authenticated widget snapshot remains blocked.

## Assets and trust boundaries

Sensitive assets:

- Neon session credentials/cookies
- account email and profile data
- workspace membership and IDs
- private My List content
- shared Task/Event data and Activity Summary history
- native push token
- widget snapshot titles

Trust boundaries:

```text
iOS application / SecureStore
  -> HTTPS + supported Neon Auth session credential
Next.js /api/v1
  -> server-side session resolution + workspace membership authorization
Neon Postgres
```

The native device is not trusted to assert a user ID or workspace ID. The server remains authoritative for identity, membership, visibility, and every mutation.

## Threats and required controls

### Credential storage

Threat: a session stored in AsyncStorage, logs, crash reports, widget shared data, or source control can be extracted and replayed.

Required controls:

- Use only the officially supported Expo auth client integration.
- Store native session/cookie material in `expo-secure-store` (iOS Keychain), never AsyncStorage.
- Never place session material in widget props, App Group snapshot data, query logs, analytics, deep-link URLs, or error messages.
- Never copy `NEON_AUTH_COOKIE_SECRET`, `DATABASE_URL`, admin keys, or other server secrets into the native repository.

### Session expiration and refresh

Threat: stale credentials appear valid locally or retry loops extend a revoked session.

Required controls:

- Treat server `401` as authoritative.
- Use the supported auth client's expiration/refresh semantics; do not mint or extend credentials locally.
- Stop retries on authentication failure, clear sensitive caches/widget state, and route to sign-in.
- Restore sessions only after secure storage is read and the server validates the session.

### Logout

Threat: a previous user's data remains in cache, SecureStore, notification state, or widgets after sign-out.

Required controls:

- Invoke the supported server logout/revocation flow.
- Clear SecureStore auth state, TanStack Query/native caches, in-memory identity, pending optimistic mutations, notification-derived state, and widget snapshots.
- Replace every widget family with an explicit signed-out snapshot and request a widget reload.
- Disable/unregister the native push token according to the server device-token model.

### Password and reset flows

Threat: the app stores a password, intercepts reset tokens, or accepts an unvalidated callback.

Required controls:

- Never persist passwords.
- Use supported Neon/Better Auth email-password calls only after the native integration gate passes.
- Until native reset is supported, open Tandem's existing HTTPS reset flow in the system browser.
- Reset links must remain single-purpose, expiring server tokens; the native app must validate scheme/host/path before routing.

### Replay and request forgery

Threat: a stolen cookie/token or forged deep link is replayed against mutation endpoints.

Required controls:

- HTTPS only outside local development.
- Preserve Neon/Better Auth cookie signing, expiry, origin, and CSRF protections.
- Use client-generated idempotency keys for create mutations, but never treat idempotency as authorization.
- Do not accept authentication or workspace authority in query/body fields.
- Apply reasonable request-size, date-window, and pagination limits.

### Stolen or shared device

Threat: someone with device access reads cached Tandem content.

Required controls:

- Keychain-backed SecureStore for credentials.
- Minimize cached private data and widget payloads.
- Respect device passcode/biometric protections provided by iOS; consider stronger SecureStore accessibility after validating background/widget requirements.
- Make sign-out complete and visible. A future app-lock feature is a separate product decision.

### Deep-link callback validation

Threat: malicious URLs trigger auth callbacks, open redirects, or foreign-item fetches.

Required controls:

- Use a fixed `tandem` scheme for development only after a new development build is created.
- Allow-list known routes; parse and validate UUID/date parameters before navigation or fetch.
- Validate OAuth/auth callback state and origin through the supported auth integration.
- Do not fabricate Apple Team ID, AASA association, or universal-link validation.
- Prefer HTTPS universal links for production once the final domain, Team ID, bundle ID, entitlements, and AASA file are approved and device-tested.

### Cross-workspace authorization / IDOR

Threat: an authenticated member supplies another workspace or item ID.

Required controls:

- Resolve the user's workspace from server membership on every request.
- Re-fetch mutation targets with both resource ID and authorized workspace (and My List owner where required).
- Return generic `NOT_FOUND` for absent and foreign records.
- Keep the two-member invariant and partner My List privacy rules server-side.
- Never rely on native route guards, hidden UI, cached membership, or widget data for authorization.

## Validation status

- Installed package/version/exports inspected: PASS.
- Better Auth Expo server/client requirements reviewed: PASS.
- Neon managed-plugin limitation reviewed: PASS.
- Secure supported native sign-in/session persistence: BLOCKED.
- Authenticated native `/api/v1/me` call: BLOCKED.
- Same-user/workspace end-to-end proof: BLOCKED.

The correct Phase 2 outcome is a documented security block, not an insecure workaround or a false end-to-end claim.
