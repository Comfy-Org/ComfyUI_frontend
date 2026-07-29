# 13. Telemetry Service Selection: PostHog, Datadog RUM, Snowflake/Hex

Date: 2026-07-28

## Status

Accepted

## Context

Incident #incident-88 (billing telemetry gap-closure work: frontend PR
[#14111](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14111) and its
backports, plus the internal billing telemetry advisory) surfaced that
billing-relevant errors had no low-latency alert path. The org had never
written down which telemetry tool a given signal should live in, so
instrumentation choices were made ad hoc per PR.

The frontend emits telemetry through `TelemetryRegistry`
(`src/platform/telemetry/`), which fans a single call out to every
registered `TelemetryProvider` (PostHog, Datadog RUM, GTM, Customer.io,
Mixpanel, Impact, ClickHouse, Syft, host sinks). Concretely,
`DatadogRumTelemetryProvider`
(`src/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider.ts`)
implements only `trackExecutionOutcome` — no billing or product actions flow
to Datadog RUM — while PostHog receives nearly everything, including
signals people expect to page on. This matters because PostHog
Insights/Alerts run on an ETL/batch cadence unsuitable for incident
response, while Datadog RUM/APM monitors evaluate near real time and are
the platform on-call already watches.

## Decision

Split telemetry responsibility by consumer and latency requirement, reached
in the #incident-88 Slack thread on 2026-07-28:

1. **Datadog (RUM + backend APM/monitors) is the alerting/incident-response
   backbone.** Anything that should page someone — errors, funnel/flow
   drop-off regressions, stability signals — is instrumented via
   `datadogRum.addAction`, RUM Funnel Analysis, and anomaly monitors,
   dual-emitted alongside PostHog through the existing `TelemetryRegistry`
   fan-out. Adding Datadog coverage for an existing event is therefore one
   more call site, not a new integration.
2. **PostHog stays the product-analytics/growth/exploratory layer.**
   Funnels, cohorts, feature flags/experiments, and session recordings for
   human-driven analysis (Growth, product, marketing) remain on PostHog; it
   is no longer a source of low-latency alerts.
3. **Snowflake + Hex is for ad hoc, human-authored SQL** joining warehouse
   data across domains that don't fit either tool's query model (e.g.
   correlating frontend telemetry against backend billing tables for a
   one-off investigation). Informational/reconciliation use only — its own
   latency is roughly an hour or more, so it is not an alerting path.

**Decision guide:** page-worthy error or funnel regression → Datadog (RUM
action + monitor). Human exploration, cohorts, experiments, self-serve
funnels → PostHog. One-off cross-domain warehouse join → Hex/Snowflake.

**Exception:** cohort- or experiment-scoped alerts stay PostHog-native
rather than being forced into Datadog, since RUM has no equivalent to
PostHog's computed cohort membership to dual-emit into.

**Alternatives rejected:** keeping PostHog as the sole alerting source
(its ETL/ingestion lag is exactly the gap #incident-88 exposed); and
putting telemetry-as-code (Terraform, dashboard/monitor JSON) in this
repo (it's public with untrusted-fork CI exposure, so credentialed IaC
belongs in a private, access-controlled infra repository instead).

## Consequences

### Positive

- A new telemetry signal has an explicit destination based on who needs to
  consume it and how fast, instead of a per-PR judgment call.
- Incident response gets a real low-latency alert path for billing and
  other error/funnel signals, closing the gap #incident-88 found.
- PostHog's exploratory strengths (cohorts, experiments, session replay)
  stay intact and unambiguous in scope. RUM cannot replace it outright —
  it has no native cohort engine or feature-flag/experiment platform.

### Negative

- Dual-emission adds a small per-event cost: one extra call site through the
  existing registry, but still a line every new alerting-relevant event
  must remember to add.
- Cohort- or experiment-scoped signals remain without a low-latency alert
  path by design — an accepted, bounded gap, not an oversight.

## Notes

- Related: frontend PR [#14111](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14111)
  and its stable-branch backports, and the internal billing telemetry
  advisory (a Slack artifact/thread, not a public URL).
- This ADR documents a decision reached in Slack; it does not itself add
  Datadog instrumentation. Follow-up PRs adding `addAction` calls or
  Datadog monitors should reference this ADR rather than re-litigate the
  split.
