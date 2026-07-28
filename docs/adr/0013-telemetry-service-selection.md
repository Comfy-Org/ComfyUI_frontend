# 13. Telemetry Service Selection: PostHog, Datadog RUM, Snowflake/Hex

Date: 2026-07-28

## Status

Accepted

## Context

Incident #incident-88 (billing telemetry gap-closure work: frontend PR
[#14111](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14111) and its
backports, the internal billing telemetry advisory, and
`comfy-infra`#454's Datadog monitors) surfaced that billing-relevant errors
had no low-latency alert path. Investigating the gap found that the org had
never written down which telemetry tool a given signal should live in.

The frontend already emits telemetry to several destinations through
`TelemetryRegistry` (`src/platform/telemetry/`), which fans a single call
out to every registered `TelemetryProvider` (PostHog, Datadog RUM, GTM,
Customer.io, Mixpanel, Impact, ClickHouse, Syft, host sinks — see
`src/platform/telemetry/providers/`). Nothing constrained which provider a
new signal should target, so instrumentation choices were made ad hoc per
PR. Concretely, `DatadogRumTelemetryProvider`
(`src/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider.ts`)
implements only `trackExecutionOutcome` — no billing or product actions
flow to Datadog RUM at all — while PostHog receives nearly everything,
including signals people expect to page on.

This matters because the tools have different latency characteristics.
PostHog Insights/Alerts run on an ETL/batch cadence, which is unsuitable
for incident response; a billing regression could sit undetected for the
length of that cadence. Datadog RUM/APM monitors evaluate close to
real time and are the platform the on-call rotation already watches.

## Decision

Split telemetry responsibility by consumer and latency requirement,
reached in the #incident-88 Slack thread on 2026-07-28:

1. **Datadog (RUM + backend APM/monitors) is the alerting/incident-response
   backbone.** Anything that should page someone — errors, funnel/flow
   drop-off regressions, stability signals derived from "product"
   statistics — is instrumented via `datadogRum.addAction`, RUM Funnel
   Analysis, and anomaly monitors. These events are dual-emitted alongside
   PostHog through the existing `TelemetryRegistry` fan-out, so adding
   Datadog coverage for an existing event is one more call site through a
   registry we already have, not a new integration.

2. **PostHog stays the product-analytics/growth/exploratory layer.**
   Funnels, cohorts, feature flags/experiments, and session recordings for
   human-driven analysis (Growth Pod, product, marketing) remain on
   PostHog. It is no longer the source of low-latency alerts, because its
   Insights/Alerts pipeline runs on an ETL/batch cadence that incident
   response cannot wait on.

3. **Snowflake + Hex is for ad hoc, human-authored SQL** joining warehouse
   data across domains that don't fit either tool's own query model — e.g.
   correlating frontend telemetry against backend billing tables for a
   one-off investigation. This is informational/reconciliation use only,
   explicitly not an alerting path: its own latency is roughly an hour or
   more.

### Decision guide

- Need to page someone on an error or a funnel-conversion regression? →
  Datadog (RUM action + monitor).
- Need a human to explore behavior, build a cohort, run an experiment, or
  self-serve a funnel without an engineer? → PostHog.
- Need to join billing data against another domain's warehouse table for a
  one-off investigation? → Hex/Snowflake.

### Exception

Alerts that are inherently cohort- or experiment-scoped stay PostHog-native
rather than being forced into Datadog. RUM has no equivalent to PostHog's
computed cohort membership, so there is nothing to dual-emit into.

## Rationale / tradeoffs

- Today's gap (`DatadogRumTelemetryProvider` implementing only
  `trackExecutionOutcome`) is a capability gap, not a design choice — it's
  the concrete evidence that Datadog was never used for the alerting cases
  it's now assigned. Closing it means adding `addAction` calls for the
  events that need to page someone, not replacing PostHog.
- RUM cannot replace PostHog outright: it has no native cohort engine and
  no feature-flag/experiment platform. PostHog is demoted from "sole
  telemetry destination" to "product-analytics-specific tool," not removed.
- Dual-emission through `TelemetryRegistry` keeps the cost of this split
  low — each provider already implements only the methods it cares about
  (see the registry's dispatch-with-optional-chaining pattern), so adding
  a Datadog-side consumer for an existing event is additive.

## Alternatives considered

- **Keep PostHog as the sole alerting source.** Rejected: PostHog's
  ETL/ingestion lag is unacceptable for incident response, which is
  exactly the gap incident #incident-88 exposed.
- **Put all telemetry-as-code (Terraform, dashboard/monitor JSON) in this
  repo.** Rejected, or at most scoped down to inert config-only if
  colocated at all. This repository is public with untrusted-fork CI
  exposure; credentialed infrastructure-as-code belongs in the private
  `comfy-infra` repository (see `comfy-infra`#454), not here.

## Consequences

### Positive

- A new telemetry signal has an explicit destination based on who needs to
  consume it and how fast, instead of a per-PR judgment call.
- Incident response gets a real low-latency alert path for billing and
  other error/funnel signals, closing the gap #incident-88 found.
- PostHog's exploratory strengths (cohorts, experiments, session replay)
  stay intact and unambiguous in scope.

### Negative

- Dual-emission adds a small per-event cost when adding new telemetry: one
  extra call site through the existing registry, not a new integration,
  but still a line every new alerting-relevant event must remember to add.
- Cohort- or experiment-scoped signals remain without a low-latency alert
  path by design, since there is no RUM equivalent for PostHog's computed
  cohort membership. This is an accepted, bounded gap, not an oversight.

## Notes

- Related: frontend PR [#14111](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14111)
  and its stable-branch backports (billing telemetry gap closure), the
  internal billing telemetry advisory (published as a Slack
  artifact/thread, not a public URL), and `comfy-infra` PR #454 (Datadog
  monitors for billing telemetry).
- `TelemetryRegistry` and its providers live in `src/platform/telemetry/`;
  see `src/platform/telemetry/providers/cloud/` for the current provider
  set (PostHog, Datadog RUM, GTM, Customer.io, Mixpanel, Impact,
  ClickHouse, Syft).
- This ADR documents a decision reached in Slack; it does not itself add
  Datadog instrumentation for any specific event. Follow-up PRs that add
  `addAction` calls or Datadog monitors should reference this ADR rather
  than re-litigate the split.
