# ADR-AUTH-IDENTITY-0028: Transitional Identity Adapter for the Account Package

Date: 2026-09-08

## Status

Proposed

## Context

The `@comfyorg/account` package owns a framework-free session client that
binds to an `IdentityPort` — a push stream of "the signed-in user changed"
events. The package also ships its own Firebase identity entry
(`createFirebaseIdentity`), which real hosts such as the Workshop site bind
directly.

The cloud app cannot bind that entry yet. Its identity authority is the Pinia
`authStore`, built on vuefire's **default** Firebase app, and its auth-state
listener carries app-wide side effects (workspace teardown, socket
re-handshake, balance and provisioning resets, telemetry). The package entry
initializes a **named** Firebase app (`comfy-account`), so the two are
distinct auth instances with distinct persistence stores — adopting the
package entry wholesale would split the session.

The stack therefore ships an adapter in `workspaceAuthStore`:
`accountUserFor` wraps the live authStore user (its `getIdToken` re-reads the
authority at call time, so a held wrapper can never serve a stale token), and
`syncUnifiedIdentity` diffs the authority against the client's snapshot and
delivers the change through a hand-rolled `IdentityPort`.

Two review findings shaped the final form:

- The 2026-09-07 audit found delivery was **call-site-driven** (only
  `mintAtLogin`, `switchUnifiedWorkspace`, and `remintUnifiedOnce` synced),
  which made correctness rest on the undocumented ordering of the auth
  listener's calls (`clearWorkspaceContext` before `mintAtLogin`).
- Christian's stack audit (PR #17127) flagged the adapter itself and asked
  that it be made one identity authority **or documented and tested as a
  temporary migration adapter**.

## Decision

Keep the adapter, as a documented transitional seam, with delivery made
event-driven:

1. The Pinia `authStore` remains the single identity authority for the cloud
   app. The package client never talks to Firebase directly here.
2. The authStore auth-state listener pushes `syncUnifiedIdentity()` on
   **every** identity event (cloud only), so the client's identity can never
   go stale between entry-point calls and no call-ordering is load-bearing.
   The unified entry points keep their own defensive syncs.
3. `syncUnifiedIdentity` is flag-guarded (`unified_cloud_auth`): with the
   flag off, the unified rail attaches nothing and holds no state.
4. `invalidate()` (package) fails closed on teardown — the client drops its
   identity snapshot and reads signed-out until the next delivery.

The contract is pinned by tests: the auth-event push in `authStore.test.ts`
("unified identity push"), the flag-off dormancy suite, and the
interleaving/race pins in `useWorkspaceAuth.test.ts`.

## Alternatives Considered

- **Single identity authority now** (package `createFirebaseIdentity` as the
  source; authStore becomes a projection): rejected for this stack. It
  requires either teaching the package to accept an existing Firebase auth
  instance or migrating the app off vuefire's default app, plus relocating
  the listener's app-wide side effects. That is its own design effort; this
  ADR is superseded the day it lands.
- **Reactive `watch` on `authStore.currentUser`** instead of listener
  pushes: rejected — the auth listener is already the single place identity
  changes enter the app, and a parallel watcher would reintroduce ordering
  ambiguity between teardown and delivery.

## Consequences

- Identity reaches the unified client with the same timing guarantees the
  rest of the app gets from the auth listener. On sign-out and identity
  change, teardown (which the listener runs first) precedes delivery; a
  first sign-in has nothing to tear down and delivers directly.
- Hosts that CAN bind the package identity directly (Workshop) do so without
  this adapter; the adapter is cloud-app-only debt with a named successor
  (the single-authority migration).
- The `comfy-account` named app stays unused by the cloud app until that
  migration; nothing may bind it in `src/` in the meantime, or two sessions
  diverge.
