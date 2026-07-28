# 13. Billing Telemetry Attempt Correlation and Workspace Scoping

Date: 2026-07-28

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

Billing telemetry has two gaps in how events can be correlated and segmented.

**Attempt correlation.** `billing_op_id` is minted by the backend and only
reaches the frontend once the initiating request _succeeds_ —
`useBillingOperationStore.startOperation(opId, type, metadata)` receives
`opId` as a required argument. Every terminal path inside the store
(`handleSuccess`/`handleFailure`/`handleTimeout`) already carries
`billing_op_id` in its `trackBillingEvent()` call. The gap is narrower than
"billing has no attempt ID": it's the single initiating HTTP call
(`workspaceApi.cancelSubscription()`, `subscribe()`, `purchaseCredits()`,
etc.) — if that call throws or times out before a `billing_op_id` is ever
returned, the resulting failure event has no identifier to join against
whatever the backend logged for that same attempt. Today, pre-response
failures are correlated only via `workspace_id` plus a timestamp window,
which is weak.

**Workspace scoping.** `getBillingTelemetryEventPayload()` builds its output
purely from fields on the `BillingTelemetryEvent` union (`operation`,
`stage`, `outcome`, `billing_op_id`, `tier`, `cycle`, `checkout_type`,
`failure_category`, etc.) — no workspace identity anywhere. No PostHog group
call (`posthog.group()`/`groupIdentify()`) exists in the codebase today; the
only identity primitive in use is per-user `posthog.identify(user.id)` in
`PostHogTelemetryProvider.ts`, fired once from
`useCurrentUser().onUserResolved()`. Because
`DatadogRumTelemetryProvider.trackBillingEvent()` calls the same
`getBillingTelemetryEventPayload()` for its `addAction()` payload, this is a
single shared gap, not two — fixing the payload builder fixes both PostHog
events and Datadog RUM actions at once. Workspace identity is already
available reactively via `useTeamWorkspaceStore().workspaceId`.

## Decision

**1. Client-side `billing_attempt_id`.** Generate a UUID
(`crypto.randomUUID()`) client-side and stamp it on every emitted event
(start and outcome) for that attempt, without sending it to the backend.
This lets a frontend "attempt" be joined to its own "outcome" even when no
`billing_op_id` ever existed, though it cannot be joined against backend
records for the same attempt.

A backend-issued, request-plumbed version of this ID (generated client-side,
sent as a request header/param, and persisted by the backend alongside the
`billing_op_id` it eventually mints) was considered as a stronger
alternative — it would let a pre-response failure be joined against backend
records too. It requires a corresponding backend change to accept and
persist the field, which crosses a service boundary and needs coordination,
so it is deferred: the gap it closes is real but narrow (only failures in
the single initiating call, before any op ID exists), and standing up a
backend-coordinated ID scheme for that slice is disproportionate until we
know its actual size. Revisit once failure-rate data (pre-response vs.
post-response share of total billing failures) justifies it.

Status quo (no client-side ID at all, relying solely on the
`workspace_id` + timestamp-window fallback) was also considered and
rejected as strictly weaker than the frontend-only ID for no savings.

**2. `workspace_id` on the shared telemetry payload, plus a PostHog group.**
Read `useTeamWorkspaceStore().workspaceId` into
`getBillingTelemetryEventPayload()`'s return spread, so every provider that
consumes it (PostHog, Datadog RUM, and any future one) gets `workspace_id`
for free. In addition, call `posthog.group('workspace', workspaceId)` once
when workspace context is established or changes — the same shape as the
existing `setSubscriptionProperties()` watcher in
`PostHogTelemetryProvider.ts` — to unlock PostHog's group-analytics UI
(group-scoped dashboards, cohorts, workspace-level success-rate insights).

The plain payload field alone would cover both tools' event-level
segmentation immediately, but does not get PostHog's group-analytics
surface, since that requires the workspace to be a registered PostHog group,
not just an event property. The group call alone would unlock PostHog's
group UI but is PostHog-specific and does nothing for Datadog RUM. Doing
both is cheap enough that there is no reason to ship only one; a later,
separate follow-up should also register `workspace_id` as a Datadog RUM
global context property (e.g. via `datadogRum.setGlobalContextProperty`) so
whole RUM sessions are segmentable by workspace, not just individual billing
actions.

## Consequences

### Positive

- Frontend billing-failure events emitted before a `billing_op_id` exists
  can now be joined to their own outcome via `billing_attempt_id`, a strict
  improvement over today's timestamp-window-only fallback.
- `workspace_id` becomes available on every billing telemetry event across
  both PostHog and Datadog RUM through one shared payload builder, with no
  per-provider duplication.
- PostHog group analytics (workspace-level dashboards, cohorts) becomes
  available going forward.
- Neither change requires a cross-service dependency to ship.

### Negative

- `billing_attempt_id` cannot be joined against backend-side records for the
  same attempt; that requires the deferred backend-coordinated option and is
  not solved by this decision.
- `workspace_id` as an event property does not by itself give Datadog RUM
  whole-session segmentation; a separate RUM global-context change is still
  needed for that.
- Personal (non-team) workspace handling for the PostHog group call, and
  what additional workspace-level properties `groupIdentify()` should set
  (plan tier, seat count, billing rail), are open and need product/analytics
  input before the group call ships.

## Notes

- Follow-up questions to resolve before or shortly after implementation:
  - What fraction of billing failures today are pre-response (no
    `billing_op_id` ever minted) vs. post-response (poll timeout, webhook
    failure)? This determines whether the backend-coordinated attempt-ID
    option is worth pursuing.
  - If the backend-coordinated option is pursued later, should it reuse an
    existing request-tracing/correlation-ID convention rather than inventing
    a new field name, and what format (raw UUIDv4 vs. a prefixed string)?
  - Should the PostHog group watcher live directly in
    `PostHogTelemetryProvider.ts`, or be hoisted somewhere both that
    provider and `DatadogRumTelemetryProvider` can trigger off the same
    workspace-change signal, for the future RUM global-context property?
  - Should personal (non-team) workspaces register as a PostHog group at
    all, or only team workspaces?
