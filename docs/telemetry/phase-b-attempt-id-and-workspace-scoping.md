# Phase B Scoping — Client Attempt ID & Workspace Scoping (incident-88)

**Scope:** Comfy-Org/ComfyUI_frontend `src/platform/telemetry/`, `src/platform/workspace/stores/billingOperationStore.ts` · touches Comfy-Org/cloud for one option below
**Related:** [`docs/telemetry/incident-88-master-plan.md`](./incident-88-master-plan.md), Phase B items 7–10
**Date:** 2026-07-28

---

## 1. Client-side `billing_attempt_id`

### Problem

`billing_op_id` is minted by the backend and only reaches the frontend once the initiating request *succeeds* — `useBillingOperationStore.startOperation(opId, type, metadata)` receives `opId` as a required argument, and `startedAt: Date.now()` is stamped only after that call, purely for client-side timeout bookkeeping. Every terminal path inside the store (`handleSuccess`/`handleFailure`/`handleTimeout`) already carries `billing_op_id` in its `trackBillingEvent()` call. The actual hole is narrower than "billing has no attempt ID": it's the single initiating HTTP call (`workspaceApi.cancelSubscription()`, `subscribe()`, `purchaseCredits()`, etc.) — if *that* call throws or times out before a `billing_op_id` is ever returned, the resulting failure event (where one is even fired — PR #14216, in flight, closes one such gap for the cancel rail) has no identifier to join against whatever the backend logged for that same attempt.

### Options considered

- **(a) Client-generates, sent to backend.** Generate a UUID (`crypto.randomUUID()`) in the composable immediately before the API call, thread it as a request header/param, backend records it alongside (or ahead of) the `billing_op_id` it eventually mints. Requires a **Comfy-Org/cloud** change to accept and persist the field — this crosses the repo boundary and needs coordination, plausibly folded into Phase A #1's shared-op-ID work rather than shipped as a second ID scheme.
- **(b) Client-generates, frontend-only.** Same UUID, stamped on every emitted event (start and outcome) for that attempt, never sent to the backend. Lets us join a frontend "attempt" to its own "outcome" even when no `billing_op_id` ever existed, but cannot be joined against backend `billing_outbox`/`billing_event` rows or Datadog `op_terminal` spans for the same attempt.
- **(c) Status quo.** Pre-response failures stay correlated only via the master plan's existing fallback: `workspace_id` + timestamp window (gap row 5). Cheapest, weakest.

### Tradeoffs

| | Effort | Cross-repo coordination | Correlation strength |
|---|---|---|---|
| (a) | Highest — new backend field, request plumbing, review on both repos | Yes — Comfy-Org/cloud | Full: frontend attempt ↔ backend record, even pre-response |
| (b) | Low — one client-side field | None | Frontend-only: attempt ↔ its own outcome, not backend logs |
| (c) | None | None | Timestamp-window fallback only |

The gap (a) fully closes is real but narrow: every operation that reaches `billingOperationStore.startOperation()` already has a `billing_op_id`, so this only affects failures in the single initiating call — network errors, immediate 4xx/5xx, client-side validation — before any op ID exists. That's a small, bursty slice of total billing failures relative to poll-timeout and webhook failures downstream, which are already covered. Standing up a second, backend-coordinated ID scheme for that slice is disproportionate until we know its actual size.

### Recommendation: (b), with (a) as a follow-up gated on data

Ship the frontend-only attempt ID now — cheap, no cross-repo dependency, and it's a strict improvement over today's "nothing" for the pre-response window. Treat (a) as a candidate for a later PR, and only pursue it once we've confirmed from Datadog/Sentry that pre-response failures are a large enough share of total billing failures to justify a coordinated Comfy-Org/cloud change (and once Phase A #1's shared op-ID plumbing has landed, since it may shrink this window further by returning an ID sooner).

### Open questions for a human to confirm

- What fraction of billing failures today are pre-response (no `billing_op_id` ever minted) vs. post-response (poll timeout, webhook failure)? Pull from Datadog `op_terminal` / Sentry grouping before deciding whether (a) is worth it.
- If we do move to (a) later, should it reuse whatever request-tracing/correlation-ID convention Comfy-Org/cloud already has, instead of inventing a new field name?
- Format: raw UUIDv4, or a prefixed string (e.g. `att_...`) for easier grepping in logs?

---

## 2. `workspace_id` / PostHog group association

### Problem

`getBillingTelemetryEventPayload()` builds its output purely from fields on the `BillingTelemetryEvent` union (`operation`, `stage`, `outcome`, `billing_op_id`, `tier`, `cycle`, `checkout_type`, `failure_category`, etc.) — no workspace identity anywhere. No `posthog.group()`/`groupIdentify()` call exists in the codebase today (confirmed by search); the only identity primitive in use is per-user `posthog.identify(user.id)` in `PostHogTelemetryProvider.ts`, fired once from `useCurrentUser().onUserResolved()`. Because `DatadogRumTelemetryProvider.trackBillingEvent()` calls the *same* `getBillingTelemetryEventPayload()` for its `addAction()` payload, this is a single shared gap, not two — fixing the payload builder fixes both PostHog events and Datadog RUM actions at once. Workspace identity is already available reactively via `useTeamWorkspaceStore().workspaceId` (a computed off `activeWorkspaceId`).

### Options considered

- **(a) Plain field on the existing payload.** Read `useTeamWorkspaceStore().workspaceId` into `getBillingTelemetryEventPayload()`'s return spread. One shared function, so every provider that already consumes it (PostHog, Datadog RUM, and any future one) gets `workspace_id` for free. Doesn't get PostHog's native group-analytics surface — group-scoped dashboards, cohorts, "workspaces with declining success rate" insights — since those require the workspace to be a registered PostHog *group*, not just an event property.
- **(b) `posthog.group('workspace', workspaceId)`.** Fire once when workspace context is established or changes — same shape as the existing `setSubscriptionProperties()` watcher in `PostHogTelemetryProvider.ts` (a `watch()` on a reactive value driving a PostHog side effect). Unlocks PostHog's group-analytics UI. PostHog-specific: has no Datadog equivalent, so it does nothing for RUM segmentation on its own.
- **(c) Both.**

### Tradeoffs

(a) is nearly free and covers both tools' *event-level* segmentation immediately. (b) is a few extra lines, mirrors an existing pattern in the same file, and is the only way to get PostHog's group-analytics features — but it's additive to (a), not a substitute: even with (b) shipped, Datadog RUM sessions still need `workspace_id` as a global RUM context property (e.g. via `datadogRum.setGlobalContextProperty`) to segment *whole sessions*, not just the one billing action — (a) alone only tags that specific `addAction()` call, not the rest of the RUM session.

### Recommendation: (c) — do both, cheaply

Ship (a) immediately: one field, zero new mechanism, benefits every current and future provider. Add (b) as a small follow-up in the same PR or the next one, watching `useTeamWorkspaceStore().workspaceId` the same way `setSubscriptionProperties()` already watches `tier`. Neither is expensive enough to defer, and (a) alone leaves PostHog's group features and full RUM session segmentation on the table for no real savings.

### Open questions for a human to confirm

- Should the (b) watcher live in `PostHogTelemetryProvider.ts` directly, or be hoisted somewhere both `PostHogTelemetryProvider` and `DatadogRumTelemetryProvider` can trigger off the same workspace-change signal (for the RUM global-context property mentioned above)?
- What workspace-level properties beyond the ID should `groupIdentify()` set — plan tier, seat count, billing rail (legacy vs. Metronome)? Needs product/analytics input on what a "declining success rate" workspace cohort should actually slice by.
- Should personal (non-team) workspaces register as a PostHog group at all, or only team workspaces (`useTeamWorkspaceStore().isPersonalWorkspace` already exists to gate this)?
- Any PII/data-residency review needed for a Datadog RUM global-context `workspace_id`, beyond what already covers `identify()`/`registerPlatformProps()`?

---

## Suggested sequencing

Both items are Phase B (frontend event-store fixes) additions, alongside master-plan items 7–10. Neither blocks or is blocked by:

- **Phase A** (`Comfy-Org/cloud` `billing_event` emission) — independent; item 1's option (a) follow-up is the only piece that would eventually touch Comfy-Org/cloud, and only after the data-gated decision above.
- **Phase C** (RUM instrumentation) — `DatadogRumTelemetryProvider.trackBillingEvent()` already exists ahead of the master plan's original phasing, and both items here flow into it for free via the shared `getBillingTelemetryEventPayload()` function, so there's no ordering dependency to manage.

Recommend landing item 2's option (a) first (trivial, no open questions block it), item 2's option (b) shortly after, and treating item 1 as a two-step: ship the frontend-only ID now, revisit the backend-correlated version once failure-rate data is in hand.
