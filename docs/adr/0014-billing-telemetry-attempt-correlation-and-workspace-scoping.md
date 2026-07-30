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

**1. Client-side `billing_attempt_id`, with `workspace_id` snapshotted
alongside it.** Generate a UUID (`crypto.randomUUID()`) client-side at
attempt start and stamp it on every emitted event for that attempt,
without sending it to the backend. At that same moment, read
`useTeamWorkspaceStore().workspaceId` once and retain both values together
on the operation record in `useBillingOperationStore` for the attempt's
lifetime. The `billing_attempt_id` half joins a frontend attempt to its own
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

**2. `workspace_id` on every event, sourced from the attempt snapshot, plus
a matching PostHog group.** Every emitted event for an attempt — terminal
or otherwise — MUST use the `workspace_id` snapshotted in Decision 1, never
a live read of `useTeamWorkspaceStore().workspaceId` at emission time:
several events fire after an `await`, and
`billingOperationStore.stopIfTimedOut()` can emit before its
inactive-workspace guard runs, so a mid-attempt switch (workspace A to B)
could otherwise mislabel A's terminal event as B. Read the snapshot into
`getBillingTelemetryEventPayload()`'s return spread so every provider gets
it for free, and call `posthog.group('workspace', workspaceId)` with that
same snapshot — not a live read — so `$groups.workspace` can never disagree
with the payload's `workspace_id`.

Group on every non-null `workspaceId`, including personal workspaces:
`useTeamWorkspaceStore` already models a personal workspace as an ordinary
entry with its own `id`, so there's no null state to special-case. This
also avoids a stale-group hazard — PostHog's
`persistence: 'localStorage+cookie'` makes `$groups` survive reloads, so a
watcher that skipped personal workspaces would leave a team → personal
transition mislabeled under the prior team, including after reload.

The payload field alone covers event-level segmentation for both tools but
skips PostHog's group UI, which needs a registered group. The group call
alone unlocks that UI but does nothing for Datadog RUM. Both are cheap
enough to ship together; a later follow-up should also register
`workspace_id` as a Datadog RUM global context property
(`setGlobalContextProperty`) so whole RUM sessions, not just individual
actions, are workspace-segmentable.

## Consequences

### Positive

- Pre-op-ID billing failures can now be joined to their own outcome via
  `billing_attempt_id` — a strict improvement over timestamp-window-only.
- `workspace_id` becomes available on every billing event across PostHog
  and Datadog RUM through one shared payload builder, closing the
  creator-vs-actor key mismatch that otherwise breaks cross-layer funnels
  for team operations. Because the payload field and the PostHog group are
  sourced from the same per-attempt snapshot, the two can never disagree.
- PostHog group analytics (workspace-level dashboards, cohorts) becomes
  available going forward, with personal workspaces included by default.
- Neither change requires a cross-service dependency to ship.

### Negative

- `billing_attempt_id` cannot be joined against backend-side records; that
  requires the deferred backend-coordinated option.
- `workspace_id` as an event property doesn't give Datadog RUM
  whole-session segmentation; a separate RUM global-context change is
  still needed.
- What additional properties `groupIdentify()` should set (plan tier, seat
  count, billing rail) is open and needs product/analytics input;
  personal-workspace group membership itself is decided above.

## Notes

Open follow-ups: what fraction of billing failures are pre- vs.
post-response (determines whether the backend-coordinated attempt-ID is
worth pursuing); whether it should reuse an existing correlation-ID
convention if so; where the PostHog group watcher should live so both
providers can share the workspace-change signal; and what additional
`groupIdentify()` properties the workspace group should carry.
