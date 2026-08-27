# 24. Billing Rail Routing Authority

Date: 2026-08-12

## Status

Proposed

## Context

Cloud billing spans two API generations: legacy user-scoped endpoints
(`/customers/*`) from before team workspaces existed, and workspace-scoped
endpoints (`/api/billing/*`). Components reach billing through the
`useBillingContext` facade, which picks an adapter based on
`useBillingRouting().type` (`'legacy' | 'workspace'`).

The rollout-flag retirement stack (#14612, #14613, #14614, #14615) removed the
feature flags that used to gate this choice. Since then the route is a function
of exactly four inputs: distribution (`isCloud`), workspace readiness, workspace
type, and `billing_rail` — a `'legacy_stripe' | 'metronome' | 'stripe'` field on
`GET /api/billing/status` that the generated schema documents as "omitted by
older servers and billing-disabled deployments".

Two problems motivated this record (raised in
[#14645](https://github.com/Comfy-Org/ComfyUI_frontend/issues/14645)):

1. **The rail is read with disagreeing predicates.**
   `useBillingRouting.ts` asks `rail === 'legacy_stripe'`;
   `launchCancellationFlow.ts` asks `rail !== 'stripe'`. A `metronome`
   workspace is classified "workspace-served" by routing but "not
   Churnkey-eligible" by cancellation. Each answer is correct today, but
   nothing forces the two sites to agree, and an unrecognised fourth rail value
   routes to workspace billing in `useBillingRouting.ts` while
   `launchCancellationFlow.ts` uses the non-Churnkey fallback dialog.
2. **The fail-open default and the `legacy_stripe` exit contract lived only in
   a review thread.** With the flags gone, the previous server-side recovery
   lever (flipping `consolidated_billing_enabled` off) no longer exists;
   recovery from a mis-routed session is a frontend rollback. That trade-off
   was agreed in the
   [#14615 review discussion](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14615#pullrequestreview-4849151766)
   but never documented anywhere durable.

## Decision

### 1. One routing matrix, decided in one place

The post-retirement routing matrix, confirmed as the intended final behavior in
the #14615 review, is:

| Condition                                   | Billing type | Cancellation UI |
| ------------------------------------------- | ------------ | --------------- |
| OSS distribution                            | `legacy`     | fallback dialog |
| Cloud, workspace not yet loaded (no `type`) | `legacy`     | fallback dialog |
| Cloud team workspace (any rail)             | `workspace`  | rail-dependent  |
| Cloud personal, rail `legacy_stripe`        | `legacy`     | fallback dialog |
| Cloud personal, rail `stripe`               | `workspace`  | Churnkey        |
| Cloud personal, rail `metronome`            | `workspace`  | fallback dialog |
| Cloud personal, no cached rail              | `workspace`  | fallback dialog |

Churnkey is available only when the rail is known to be `stripe`; every other
rail (including unknown) uses the fallback cancellation dialog. "No cached
rail" means the session never received one: an omitted rail or a failed
refresh does not clear an already-cached value, so a session that once saw
`legacy_stripe` keeps routing to legacy until a response delivers a different
rail.

All consumers must obtain rail classification from a single shared decision
site (`getBillingRailPolicy` in `src/composables/billing/billingRailPolicy.ts`)
rather than comparing `billing_rail` inline. That site handles the
`BillingRail` union exhaustively (`satisfies never` on the default branch), so
adding a literal to the generated union fails `pnpm typecheck` at this one
site until the new rail is classified. The generated union is compile-time
only — a new runtime value cannot break an already-built bundle — so the same
site also handles the runtime states explicitly: an absent rail (`null` — not
yet fetched, omitted, or fetch failed) and a rail value this build does not
recognize both return the fail-open policy.

### 2. Unknown rail fails open to workspace billing, deliberately

A loaded Cloud personal workspace with no cached rail routes to **workspace**
billing. Inverting this (requiring a rail known to be workspace-served) was
considered during the #14615 review and rejected: it would restore the retired
flag-off behavior for every personal workspace whose canonical status has not
yet produced a rail, contrary to the agreed final routing. `legacy_stripe` is
an explicit backend compatibility contract that preserves legacy
balance/top-up/management for not-yet-migrated customers; it must be asserted
by the backend, not assumed by the frontend.

The window is self-limiting: the rail cache
(`teamWorkspaceStore.billingRailByWorkspaceId`, in-memory, non-persisted) is
written from every `/api/billing/status` response that carries a rail, and
routing follows it reactively. A `legacy_stripe` customer who boots with an
empty cache is mis-routed only until the first successful status response,
which delivers the rail and flips routing to legacy. The window does not close
when `/api/billing/status` persistently fails or persistently omits the rail
(older servers, billing-disabled deployments) — in those deployments workspace
billing is the accepted destination.

Accepted risk: if the backend serves a wrong rail, or a `legacy_stripe`
deployment persistently omits it, a legacy customer's balance, top-up and
cancel operations go to `/api/billing/*` instead of `/customers/*`. There is no
server-side kill switch anymore; recovery is a frontend rollback.

### 3. The `legacy_stripe` exit condition

- **Who flips it:** the backend only. `billing_rail` is the durable workspace
  billing authority; the frontend never writes it and holds no persistent copy.
  A personal workspace leaves the legacy rail when the backend migrates the
  customer off user-scoped Stripe and `/api/billing/status` starts returning
  `stripe` (or `metronome`) instead of `legacy_stripe`.
- **When the frontend notices:** at the next `/api/billing/status` response
  after the flip. The two cache writers are `useWorkspaceBilling` (workspace
  path) and `useSubscription` (legacy path, reachable only once routing has
  already resolved to legacy). An open session keeps its cached rail until one
  of them observes the new value; a fresh session starts from `null` and
  fail-opens to workspace, which for a completed `legacy_stripe → stripe`
  migration is already the correct destination.
- **In the window between flip and next fetch:** an open legacy-routed session
  keeps using `/customers/*` until its next status refresh. The backend must
  therefore keep legacy endpoints serving (at minimum read-only) for
  already-open sessions during a migration; the frontend has no push channel
  for rail changes.

### 4. Deployment ordering contract

The frontend routing stack deploys before the backend removes compatibility
keys, and stale frontend versions must drain first (see #14615). Reverting the
retirement stack after backend key removal is not a behavioral restore, because
a reinstated read of a deleted key resolves to the off branch. This ADR is the
durable record of that contract now that it no longer lives only in PR bodies.

## Consequences

### Positive

- A rail value cannot be classified two different ways: routing and
  cancellation both read one decision site.
- A fourth `billing_rail` literal added to the generated union breaks the
  build until it is classified; a runtime value unknown to an already-built
  bundle follows the documented fail-open policy rather than being read two
  different ways.
- The fail-open default, its rationale, and its recovery model are recorded
  where reviewers and incident responders can find them.

### Negative

- Fail-open means a mis-set or persistently missing rail mis-routes a
  `legacy_stripe` customer's money operations, and the only recovery is a
  frontend rollback.
- The exit-condition contract depends on backend behavior (keeping legacy
  endpoints alive during migration, asserting `legacy_stripe` reliably) that
  this repository cannot enforce or test.
- Cancellation-UI selection (`stripe` → Churnkey) remains a second axis of the
  same field; the single decision site must express both axes without implying
  they are one question.

## Notes

- Motivating issue: [#14645](https://github.com/Comfy-Org/ComfyUI_frontend/issues/14645)
- Retirement stack: [#14612](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14612),
  [#14613](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14613),
  [#14614](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14614),
  [#14615](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14615)
- Fail-open discussion: [#14615 review thread on `useBillingRouting.ts:32`](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14615#pullrequestreview-4849151766)
- Related ADRs: [ADR-0011](0011-derived-credential-lifecycle.md) (auth
  invariants), [ADR-0014](0014-billing-telemetry-attempt-correlation-and-workspace-scoping.md)
  (billing telemetry)
