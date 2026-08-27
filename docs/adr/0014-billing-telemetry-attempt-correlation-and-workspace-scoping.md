# 14. Billing Telemetry Attempt Correlation and Workspace Scoping

Date: 2026-07-28

## Status

Proposed

## Context

Billing telemetry has two correlation/segmentation gaps.

**Attempt correlation.** `billing_op_id` is minted by the backend and only
reaches the frontend once the initiating request _succeeds_. Every terminal
path in `useBillingOperationStore` (`handleSuccess`/`handleFailure`/
`handleTimeout`) already carries `billing_op_id`. The gap is the single
initiating HTTP call (`cancelSubscription()`, `subscribe()`,
`purchaseCredits()`, etc.): if it throws or times out before an op ID is
ever returned, the failure event has nothing to join against what the
backend logged for that attempt — today's fallback, `workspace_id` plus a
timestamp window, is weak.

**Workspace scoping.** `getBillingTelemetryEventPayload()` builds its
output purely from `BillingTelemetryEvent` fields (`operation`, `stage`,
`outcome`, `billing_op_id`, `tier`, `cycle`, `checkout_type`,
`failure_category`) — no workspace identity, and no PostHog group call
exists anywhere; the only identity primitive in use is per-user
`posthog.identify(user.id)`. Since `DatadogRumTelemetryProvider` calls the
same payload builder, this is one shared gap, not two. Workspace identity
is already available via `useTeamWorkspaceStore().workspaceId`.

This gap is more than a segmentation nicety. Backend billing records are
keyed by the workspace **creator**, while frontend telemetry events are
keyed by the **acting user**. A team operation performed by any member who
didn't create the workspace therefore joins to nothing at the first
backend step — a 100% apparent drop-off — and personal-workspace testing
never surfaces it, since creator and actor are always the same person
there. `workspace_id` is consequently the prerequisite common scope for a
valid cross-layer funnel, not an optional enhancement for group-analytics
UI.

## Decision

**1. Client-side `billing_attempt_id`, carried in a rail-neutral attempt
context together with a `workspace_id` snapshot.** At attempt start —
before the initiating composable's first `await` — generate a UUID
(`crypto.randomUUID()`) and read `useTeamWorkspaceStore().workspaceId`
once, and hold both in a local _attempt context_ (a plain object owned by
the composable — `useSubscriptionCheckout.ts`, `useResubscribe.ts`, the
legacy top-up rail, etc.) rather than on a `useBillingOperationStore`
record. That store cannot be the universal carrier: its records require a
server-issued `opId` and are created by `startOperation()` only after the
initiating request succeeds, so the motivating pre-response failure — the
initiating call itself throwing or timing out — never gets a record;
`resubscribe()` and the legacy top-up rail also emit `BillingTelemetryEvent`s
without ever calling `startOperation()`. Every event fired during the
attempt, pre-response failures included, reads `billing_attempt_id` and
`workspace_id` from this local context, never from the store. If the
attempt progresses far enough to receive a server-issued `opId`, the same
context is passed into `startOperation()`, which retains both values on the
operation record so the polling-driven terminal events
(`handleSuccess`/`handleFailure`/`handleTimeout`) read them from there
instead. The `billing_attempt_id` half joins a frontend attempt to its own
outcome even when no `billing_op_id` ever existed, though it still can't
join backend records.

A stronger alternative — a backend-issued, request-plumbed ID, persisted
alongside the eventual `billing_op_id` — was considered; it would let
pre-response failures join backend records too, but needs a cross-service
backend change. Deferred: the gap it closes (failures in the single
initiating call, before any op ID exists) is narrow, so a
backend-coordinated scheme is disproportionate until failure-rate data
justifies it. Status quo (no client-side ID) was also rejected as strictly
weaker for no savings.

**2. `workspace_id` on every event, sourced from the attempt context, with
PostHog groups applied per event rather than globally.** Every emitted
event for an attempt — terminal or otherwise — MUST use the `workspace_id`
carried in the attempt context from Decision 1, never a live read of
`useTeamWorkspaceStore().workspaceId` at emission time: several events fire
after an `await`, and a timeout guard on the operation store can emit
before its inactive-workspace check runs, so a mid-attempt switch
(workspace A to B) could otherwise mislabel A's terminal event as B. Read
the context value into `getBillingTelemetryEventPayload()`'s return spread
so every provider gets it for free.

`posthog.group(type, key)` calls `register({ $groups: {...} })`
internally — a _persistent_ super property that, under this project's
`persistence: 'localStorage+cookie'` config, is attached to every
subsequent event and survives reloads, not just the event that triggered
the call. If the billing capture path called `group('workspace', workspaceId)`
with its own snapshot, a late terminal event for a stale workspace (A)
after the user has switched to B would label itself A correctly but then
leave every later, unrelated event mislabeled A too, until some other
workspace switch happens to fire `group()` again. `posthog.group()` is
therefore owned exclusively by a dedicated active-workspace watcher —
analogous to the existing `watch(tier, ...)` in
`PostHogTelemetryProvider.setSubscriptionProperties()` — and the billing
capture path never calls it. Instead the capture path attaches its
snapshot as an event-local override, passing
`$groups: { workspace: workspaceId }` inside the properties object given to
`posthog.capture()` alongside the `workspace_id` payload field, so a late
or stale event is labeled correctly on itself without mutating the global
state that unrelated, subsequent events would otherwise inherit.

The watcher groups every non-null `workspaceId`, including personal
workspaces: `useTeamWorkspaceStore` already models a personal workspace as
an ordinary entry with its own `id`, so there's no null state to
special-case. This also avoids a stale-group hazard on the watcher itself —
skipping personal workspaces would leave a team → personal transition
mislabeled under the prior team, including after reload, for the same
persistence reason above.

The payload field plus the event-local `$groups` override covers
event-level segmentation for both tools but skips PostHog's group UI, which
needs a registered group — that's what the watcher's `posthog.group()` call
is for. Both are cheap enough to ship together; a later follow-up should
also register `workspace_id` as a Datadog RUM global context property
(`setGlobalContextProperty`) so whole RUM sessions, not just individual
actions, are workspace-segmentable.

## Consequences

### Positive

- Pre-op-ID billing failures can now be joined to their own outcome via
  `billing_attempt_id` — a strict improvement over timestamp-window-only.
- The attempt context is rail-neutral: `resubscribe()` and the legacy
  top-up rail get `billing_attempt_id`/`workspace_id` correlation for free,
  without either being retrofitted into `useBillingOperationStore`.
- `workspace_id` becomes available on every billing event across PostHog
  and Datadog RUM through one shared payload builder, closing the
  creator-vs-actor key mismatch that otherwise breaks cross-layer funnels
  for team operations. Because the payload field and the event-local
  `$groups` override are sourced from the same per-attempt context, a
  billing event's `workspace_id` and its own group attribution can never
  disagree with each other — regardless of what the live active-workspace
  watcher has registered globally at that moment.
- PostHog group analytics (workspace-level dashboards, cohorts) becomes
  available going forward, with personal workspaces included by default.
- Neither change requires a cross-service dependency to ship.

### Negative

- `billing_attempt_id` cannot be joined against backend-side records; that
  requires the deferred backend-coordinated option.
- Once an attempt reaches the polling phase, `billing_attempt_id`/
  `workspace_id` are held by both the attempt context and
  `useBillingOperationStore`; the `startOperation()` handoff keeping them in
  sync is the initiating composable's responsibility, not the store's.
- `workspace_id` as an event property doesn't give Datadog RUM
  whole-session segmentation; a separate RUM global-context change is
  still needed.
- What additional properties `groupIdentify()` should set (plan tier, seat
  count, billing rail) is open and needs product/analytics input;
  personal-workspace group membership itself is decided above.

## Notes

**Implemented as `checkout_attempt_id`, not `billing_attempt_id`.** The
subscription-checkout rail ships this decision under the name
`checkout_attempt_id`, for two reasons. The field already exists in this
codebase under that name on the legacy GA4 path
(`subscriptionCheckoutTracker.ts`, `BeginCheckoutMetadata`,
`SubscriptionSuccessMetadata`), so a second name for the same concept would
have been the only ambiguity in the schema. It is also the name in the
cross-service billing-telemetry schema that the backend and the rollout
dashboard are being built against, and a correlation key is worth nothing if
the two sides spell it differently. Rails other than subscription checkout
are not yet retrofitted.

The same work also takes the step this ADR deferred: `checkout_attempt_id`
is now sent to the backend on `preview-subscribe` and `subscribe` so it can
be stamped on the billing-op row, which is what lets a pre-op-ID failure
join backend records rather than only its own outcome. The deferral
reasoning above stands for the rails that still lack it.

Open follow-ups: what fraction of billing failures are pre- vs.
post-response (determines whether the backend-coordinated attempt-ID is
worth pursuing); whether it should reuse an existing correlation-ID
convention if so; where the PostHog group watcher should live so both
providers can share the workspace-change signal; and what additional
`groupIdentify()` properties the workspace group should carry.
