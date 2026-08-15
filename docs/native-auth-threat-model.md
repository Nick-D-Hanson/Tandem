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

Current Neon guidance says Managed Better Auth plugins are configured by Neon rather than installed directly. The August 2026 roadmap lists Next.js and browser React frameworks as supported, but does not list Expo/React Native; standalone frontend/backend architectures are still marked “coming soon.” The Expo plugin is not in the managed plugin list. That conflicts directly with the documented Expo integration prerequisite.

Managed Better Auth now does expose a supported JWT plugin. It issues Ed25519-signed access tokens with a fixed 15-minute lifetime and a public JWKS endpoint. Tandem can safely validate those JWTs at `/api/v1` without trusting client claims. This narrows the gap, but does not close it: an Expo client still needs a supported way to establish, securely persist, revoke, and refresh the underlying Neon session. A short-lived access JWT alone is not a refresh/session design, and Tandem will not invent a long-lived refresh token or proxy users' passwords through an ad hoc bridge.

References reviewed:

- https://better-auth.com/docs/integrations/expo
- https://neon.com/docs/auth/overview
- https://neon.com/docs/auth/roadmap
- https://neon.com/docs/auth/guides/plugins
- https://neon.com/docs/auth/guides/plugins/jwt
- https://docs.expo.dev/develop/authentication/
- https://docs.expo.dev/linking/into-your-app/

No custom bearer token, manually replayed cookie, second user system, direct database connection, or weakened origin/CSRF behavior will be introduced to bypass this gap.

## Safe path to unblock

Production native authentication can proceed when one of these supported conditions is explicitly available and verified:

1. Neon documents and ships first-class Expo/React Native session support for Managed Better Auth, including secure persistence, refresh/revocation, native callback schemes, and JWT retrieval.
2. Neon explicitly confirms that `@better-auth/expo`'s client plugin is supported against its managed endpoint without the Expo server plugin, and documents the exact trusted-domain/callback setup.
3. A future `@neondatabase/auth` or `@neondatabase/neon-js` release exports a documented native adapter whose session can obtain/refresh the managed 15-minute JWT.
4. The user approves a separately reviewed migration to self-hosted Better Auth on Neon Postgres with `@better-auth/expo`. Neon remains the database, but this is an authentication-platform migration and requires a user/session migration and rollback plan.

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
- Neon managed plugin/roadmap and JWT capability reviewed: PASS.
- Server-side Neon JWT verification path: DOCUMENTED, not yet enabled.
- Secure supported native sign-in/session persistence: BLOCKED.
- Authenticated native `/api/v1/me` call: BLOCKED.
- Same-user/workspace end-to-end proof: BLOCKED.

The correct Phase 2 outcome is a documented security block, not an insecure workaround or a false end-to-end claim.

## Questions for Neon support

Before changing production configuration, obtain written answers for the exact managed Auth version used by Tandem:

1. Is `@neondatabase/neon-js/auth` officially supported in Expo SDK 57 / React Native without a browser cookie jar?
2. How should an Expo app securely persist and refresh the Managed Better Auth session after email/password or OAuth sign-in?
3. Can `@better-auth/expo/client` connect to a Managed Better Auth endpoint without the `@better-auth/expo` server plugin? If yes, what cookie names/origin override are supported?
4. Can `tandem://` and a future HTTPS universal-link callback be allow-listed as trusted domains, and what callback validation does Neon perform?
5. Is `authClient.token()` supported from that native session, including rotation/revocation after logout?
6. Does Neon have a supported migration path if Tandem later moves between Managed Better Auth and self-hosted Better Auth while retaining existing users?
