# ADR-AUTH-IDENTITY-0028: Transitional Identity Adapter for the Account Package

Date: 2026-09-08

## Status

Proposed

## Context

The cloud app holds two Firebase identity surfaces:

- The Pinia `authStore`, built on vuefire's default Firebase app. Its
  auth-state listener carries app-wide side effects: workspace teardown,
  socket re-handshake, balance and provisioning resets, telemetry.
- The `@comfyorg/account` session client, which binds identity through an
  `IdentityPort` — a push stream of signed-in-user changes. The package ships
  its own Firebase entry (`createFirebaseIdentity`), which initializes a
  named app (`comfy-account`).

The two cannot share one Firebase instance. The named app and the vuefire
default app hold separate persistence stores, so binding both in one host
splits the session. Moving the cloud app onto the package entry requires
either teaching the package to accept an existing auth instance or migrating
the app off vuefire, and relocating the listener's side effects — a
migration with its own design surface.

Identity therefore reaches the session client through an adapter in
`workspaceAuthStore`: `accountUserFor` wraps the live authStore user (its
`getIdToken` re-reads the authority at call time, so a held wrapper cannot
serve a stale token), and `syncUnifiedIdentity` diffs the authority against
the client's snapshot and delivers changes through a hand-rolled
`IdentityPort`.

## Decision

The adapter is a documented transitional seam governed by these rules:

1. The Pinia `authStore` is the single identity authority for the cloud
   app. The session client never talks to Firebase directly here.
2. Delivery is event-driven: the authStore auth-state listener pushes
   `syncUnifiedIdentity()` on every identity event (cloud only), so the
   client's identity cannot go stale between entry-point calls and no
   call-ordering between the unified entry points is load-bearing. The
   entry points keep their own defensive syncs.
3. `syncUnifiedIdentity` is guarded by `unified_cloud_auth`: with the flag
   off, the unified rail attaches nothing and holds no state.
4. On sign-out and identity change, the listener tears the workspace
   context down before delivering the diff; a first sign-in has nothing to
   tear down and delivers directly. `invalidate()` fails closed — the
   client drops its credential, its cache, and its identity snapshot, and
   reads signed-out until the next delivery.
5. Nothing in `src/` may bind the package's `createFirebaseIdentity` while
   this adapter exists; a second auth instance diverges the session.

The contract is pinned by the "unified identity push" test in
`authStore.test.ts` and the flag-off dormancy suite in
`useWorkspaceAuth.test.ts`.

## Alternatives Considered

- **Single identity authority now** — the package entry as the source, with
  `authStore` reduced to a projection. Rejected at this migration stage for
  the two blockers in Context (auth-instance split, listener side-effect
  relocation). That migration supersedes this ADR when it lands.
- **A reactive `watch` on `authStore.currentUser`** instead of listener
  pushes. Rejected: the auth listener is already the single place identity
  changes enter the app, and a parallel watcher reintroduces ordering
  ambiguity between teardown and delivery.

## Consequences

- Identity reaches the unified client with the same timing guarantees the
  rest of the app gets from the auth listener.
- Hosts that can bind the package identity directly (the Workshop site) do
  so without this adapter; the adapter is cloud-app-only debt with a named
  successor.
- The `comfy-account` named app stays unused by the cloud app until the
  single-authority migration.
