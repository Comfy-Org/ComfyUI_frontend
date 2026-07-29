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

## Decision

**1. Client-side `billing_attempt_id`.** Generate a UUID
(`crypto.randomUUID()`) client-side and stamp it on every emitted event for
that attempt, without sending it to the backend. This joins a frontend
attempt to its own outcome even when no `billing_op_id` ever existed,
though it still can't join backend records.

A stronger alternative — a backend-issued, request-plumbed ID, persisted
alongside the eventual `billing_op_id` — was considered; it would let
pre-response failures join backend records too, but needs a cross-service
backend change. Deferred: the gap it closes (failures in the single
initiating call, before any op ID exists) is narrow, so a
backend-coordinated scheme is disproportionate until failure-rate data
justifies it. Status quo (no client-side ID) was also rejected as strictly
weaker for no savings.

**2. `workspace_id` on the shared payload, plus a PostHog group.** Read
`workspaceId` into `getBillingTelemetryEventPayload()`'s return spread so
every provider gets it for free, and call
`posthog.group('workspace', workspaceId)` once when workspace context
changes (mirroring the existing `setSubscriptionProperties()` watcher) to
unlock PostHog's group-analytics UI.

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
  and Datadog RUM through one shared payload builder.
- PostHog group analytics (workspace-level dashboards, cohorts) becomes
  available going forward.
- Neither change requires a cross-service dependency to ship.

### Negative

- `billing_attempt_id` cannot be joined against backend-side records; that
  requires the deferred backend-coordinated option.
- `workspace_id` as an event property doesn't give Datadog RUM
  whole-session segmentation; a separate RUM global-context change is
  still needed.
- Personal (non-team) workspace handling for the group call, and what
  additional properties `groupIdentify()` should set (plan tier, seat
  count, billing rail), are open and need product/analytics input first.

## Notes

Open follow-ups: what fraction of billing failures are pre- vs.
post-response (determines whether the backend-coordinated attempt-ID is
worth pursuing); whether it should reuse an existing correlation-ID
convention if so; where the PostHog group watcher should live so both
providers can share the workspace-change signal; and whether personal
workspaces should register as a PostHog group at all.
