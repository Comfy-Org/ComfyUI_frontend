# ADR-AUTH-IDENTITY-0028: The Account Package's Firebase Entry Delivers Identity to the Cloud Session Client

Date: 2026-09-09

## Status

Proposed

## Context

The cloud app holds two consumers of Firebase identity:

- The Pinia `authStore`, built on vuefire's default Firebase app. Its
  auth-state listener carries app-wide side effects: workspace teardown,
  socket re-handshake, balance and provisioning resets, telemetry.
- The `@comfyorg/account` session client, which binds identity through an
  `IdentityPort`. The account TDD reserves that port for test fakes; real
  hosts pass the package's own Firebase entry, `createFirebaseIdentity`.

The entry accepts an existing `Auth` instance (`createFirebaseIdentity({
auth })`), so binding it to vuefire's instance creates no second app and no
second persistence store. The remaining question was ordering: the auth
listener must tear the workspace context down before the client mints for
a new identity, and Firebase fires observers in registration order, which
is not a contract to build on.

## Decision

1. Identity reaches the session client through the package entry bound to
   the app's own `Auth` instance: `authStore` creates
   `createFirebaseIdentity({ auth })` and `workspaceAuthStore` attaches it
   as the client's `IdentityPort`. No hand-rolled port exists in `src/`.
2. The Pinia `authStore` is a projection for app-wide side effects. It is
   not an identity authority for the session client and pushes nothing
   into it.
3. Ordering between the auth listener and the port is not load-bearing:
   the client's `invalidate()` drops only the credential and keeps the
   identity, the port callback fails closed on an identity change by
   itself, and every host mint waits for the port to have delivered the
   app's current user before it runs (`unifiedUser()`), so a mint can
   neither run for a stale identity nor be lost to teardown. That wait
   reads `authStore.currentUser` only to know which uid to wait for, a
   convergence check between two projections of one `Auth` instance; the
   port's user is what mints. The wait is bounded, so a silent port fails
   the mint closed instead of hanging the auth gate. Mints stay
   host-driven (`autoMint: false`), so telemetry and coalescing are
   unchanged.
4. `syncUnifiedIdentity` is gone; the flag rule stays: with
   `unified_cloud_auth` off the port is never attached and no state is
   held.
5. Nothing in `src/` may initialize a second Firebase app through
   `createFirebaseIdentity({ options })` while the app runs on vuefire; a
   second auth instance diverges the session. Package-initialized Firebase
   for the cloud app (dropping the `VueFire` plugin and `useFirebaseAuth`)
   is a separate migration and the one remaining divergence from the TDD's
   "the package initializes Firebase".

The contract is pinned by the "unified identity source" test in
`authStore.test.ts`, the identity-driven cases in `useWorkspaceAuth.test.ts`
(driven through a fake port, never through the store), and the package's
"keeps the identity after invalidation" test.

## Alternatives Considered

- **Transitional Pinia adapter** (the previous text of this ADR): the auth
  listener diffed `authStore.currentUser` into a hand-rolled port and the
  entry points re-synced defensively. Superseded once `invalidate()`
  stopped erasing the identity, which was the only reason the adapter had
  to re-deliver.
- **A reactive `watch` on `authStore.currentUser`**: rejected, it keeps
  Pinia as the messenger and reintroduces ordering ambiguity.
- **Package-initialized Firebase now**: rejected at this stage for the
  vuefire coupling in rule 5; it supersedes rule 5 when it lands.

## Consequences

- The cloud app and the Workshop site bind identity the same way, through
  the same package entry, so the session behaviour cannot drift between
  them.
- Token reads go through the Firebase `User` directly; a transient read
  failure is a retried transient exchange failure, not a permanent
  not-authenticated error.
- The `comfy-account` named app stays unused by the cloud app until the
  package-initialized migration.
