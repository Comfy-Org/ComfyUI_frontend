# 11. Derived Credential Lifecycle for Cloud Auth

Date: 2026-07-09

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

Cloud authentication derives several short-lived credentials from a single
source of truth — the Firebase identity (ID token):

- the **workspace JWT** minted by exchanging the Firebase token (`workspaceAuthStore`),
- the **session cookie** created by POSTing the Firebase token to `/auth/session`
  (`useSessionCookie`),
- and consumer state gated on those credentials, such as **subscription status**
  (`useSubscription`).

A recurring class of production bugs traces back to how these derived credentials
are kept fresh rather than to any single code path:

- **FE-613** — workspace token exchange is not reactive to Firebase auth state.
  Its refresh relies on a `setTimeout` timer that browsers throttle in background
  tabs, so a backgrounded session serves an expired workspace JWT and every cloud
  call 401s until reload.
- **Workspace/personal oscillation** (PR #13511) — when a valid workspace token is
  momentarily absent, `getAuthHeader`/`getAuthToken` silently downgraded to the
  personal Firebase token, so requests authenticated as the wrong identity.
- **Run-button toggle loop** (Slack, related to FE-1072) — a Firebase token-refresh
  burst on wake/network-swap fans out into concurrent, undeduped subscription
  fetches racing an in-flight session-cookie rotation; some land pre-rotation and
  return 401/empty, flapping `subscriptionStatus` and the run button.

These are not independent defects. They are symptoms of one design shape: **each
derived credential has its own ad-hoc refresh lifecycle, driven by timers or
one-shot events rather than the source identity, with no coalescing of concurrent
refreshes and with silent fallback to a different identity or a stale value on
failure.** Any credential built this way can go stale, stampede, or downgrade.

## Decision

Treat every derived credential as a pure function of the Firebase identity, and
require all of them to obey the same lifecycle invariants. New auth code must
satisfy these; existing code migrates toward them incrementally.

1. **Single source of truth.** The Firebase identity is authoritative. Workspace
   JWT and session cookie are derivations of it, never independent state that can
   drift from it.

2. **Valid-on-read.** A caller asking for a credential gets a currently-valid one
   or a definitive failure — never a known-expired one. Validity is checked at the
   point of use (expiry-aware), not assumed because a background timer _should_
   have refreshed. Timers may be an optimization, never the guarantee.

3. **Single-flight.** Concurrent requests for the same credential share one
   in-flight mint/refresh. A refresh burst collapses to a single network call.

4. **Fail-closed, never downgrade.** If the correct-scope credential cannot be
   obtained, fail the request. Never silently substitute a different identity or
   scope (e.g. personal token for a workspace request).

5. **Bounded reactive retry.** Invalidation is driven by the source identity
   (`onIdTokenChanged`), not by polling or wall-clock timers alone. A `401` on a
   derived credential triggers at most one re-mint and one retry, then surfaces
   the error.

6. **Explicit scope.** A credential names the identity/workspace it is for.
   Coalesced results are verified against the requested scope before use.

PR #13511 is the first increment: workspace-token recovery is now valid-on-read,
single-flight, fail-closed, and reconciles a revoked workspace instead of
downgrading; subscription-status and session-cookie creation are now
single-flight so a refresh burst can no longer flap them. It intentionally does
**not** yet add the `onIdTokenChanged` subscription FE-613 proposes — recovery is
lazy (on read) rather than reactive (on refresh). Invariant 5 is the remaining
gap and is tracked by FE-950 (Unified Cloud Auth) and FE-963 (reactive 401
re-mint + single retry).

Alternatives considered:

- **Layer more defensive checks per call site.** Rejected: this is what produced
  the current state — correctness that depends on every caller remembering to
  guard is the defect, not the fix.
- **A single reactive credential store subscribing to Firebase, replacing all
  three ad-hoc lifecycles at once.** Deferred, not rejected: it is the target
  end-state, but a big-bang rewrite of live auth is too risky. We migrate under
  these invariants incrementally instead.

## Consequences

### Positive

- Whole categories of failure become structurally hard rather than individually
  patched: stale-on-wake (invariant 2), refresh stampede (3), wrong-identity
  requests (4).
- New auth code has a single checklist to satisfy, and reviewers a single rubric
  to apply.
- Establishes a shared vocabulary (valid-on-read, single-flight, fail-closed) for
  reasoning about auth changes.

### Negative

- Fail-closed surfaces auth failures that silent downgrade previously masked; some
  transient conditions now show errors instead of degrading quietly, so
  transient-vs-permanent classification must be correct.
- The invariants are not yet fully realized. Until invariant 5 lands, recovery is
  lazy and a backgrounded tab still relies on the next read to heal, leaving a
  visible gap against FE-613's reactive ideal.
- Existing lifecycles remain non-uniform during migration, so the mental model is
  "target vs. current" until the reactive credential store exists.

## Notes

- Related: [ADR-0003](0003-crdt-based-layout-system.md) is unrelated in domain but
  shares the philosophy of designing invariants that make illegal states
  unrepresentable rather than guarding against them per call site.
- Tickets: FE-613, FE-950, FE-963, FE-1072. PR: #13511.
