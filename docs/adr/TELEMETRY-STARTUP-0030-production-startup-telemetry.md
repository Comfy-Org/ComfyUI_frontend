# ADR-TELEMETRY-STARTUP-0030: Production Startup Telemetry

Date: 2026-09-08

## Status

Proposed

## Context

Cloud users intermittently report initial loads of two to three minutes
against a profiled healthy load of roughly five seconds
([BE-5708](https://linear.app/comfy/issue/BE-5708)). When asked how many users
were affected, nobody could answer: the only evidence was one-off Lighthouse
runs and individual reports.

[#14079](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14079) added a
bootstrap tracer that names each startup phase and writes marks and measures to
the browser Performance API. Reviewing it surfaced that the way a startup
signal reaches a console is not obvious, and that the obvious-looking choices
are each wrong in a different way:

- The original implementation emitted to `window.DD_RUM`, a global this app
  never defines — RUM arrives through the `@datadog/browser-rum` package, so
  every emission was a silent no-op while the accompanying test stubbed the
  global and passed.
- Routing through `TelemetryRegistry` looks correct per
  [ADR-TELEMETRY-ROUTING-0013](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md),
  but the registry is null until `initTelemetry()`'s dynamic imports resolve,
  which is itself a startup phase. A startup that stalls before that point
  produces nothing. #14079 worked around this by dynamically importing the
  Datadog provider when the registry was absent.
- Hand-rolled totals as custom action attributes duplicate fields RUM already
  populates, and require a bespoke dashboard to read what the product charts
  natively.

Two properties of the RUM SDK (6.33.0) decide most of this and were not
obvious from the call sites:

1. Public API calls made before `datadogRum.init()` are **buffered**, not
   dropped — a 500-entry bounded buffer drained on init — and `addTiming`
   stamps its timestamp at call time. The boot path can therefore emit
   eagerly and correctly.
2. `initDatadogRum()` is fired from `src/bootstrap.ts`, the module
   `index.html` actually loads, before `./main` is imported. RUM is coming up
   from the first moment of the page, well ahead of the registry.

Startup measurement also already has a lane:
[ADR-PERF-BENCHMARKS-0022](PERF-BENCHMARKS-0022-performance-evidence-and-regression-framework.md)
covers deterministic gates and controlled distribution benchmarks. That lane
answers "did this PR regress a scenario on a fixed identity." It cannot answer
"how many real users had a bad load last week," because it has no real users.

## Decision

Production startup telemetry is a separate lane from
ADR-PERF-BENCHMARKS-0022's lab measurement, and uses the native RUM primitive for each question rather than
reconstructing one.

### Which primitive carries what

| Signal                             | Mechanism                         | Lands in                       |
| ---------------------------------- | --------------------------------- | ------------------------------ |
| Phase boundary                     | `datadogRum.addTiming(phase)`     | `@view.custom_timings.<phase>` |
| Current RUM view loading time      | `datadogRum.setViewLoadingTime()` | `@view.loading_time`           |
| Per-attempt outcome and breakdown  | `app:bootstrap_complete` action   | `@context.*`                   |
| Phase timings attached to an error | Sentry breadcrumb                 | breadcrumb trail               |
| Local investigation                | `performance.mark`/`measure`      | DevTools timeline              |

Custom timings and `view.loading_time` are charted and monitored by Datadog
without a bespoke dashboard. We do not recompute either as an action
attribute, and we do not use a duration vital for the page load: duration
vitals describe discrete operations inside a view, such as
`workflow_execution`, not the load of the view itself.

`setViewLoadingTime()` measures from the start of the current RUM view. When a
route change creates a new view during startup, such as a login redirect,
`@view.loading_time` covers only the final view segment. The aggregate action's
`@context.total_ms` covers the complete startup attempt.

### The aggregate action still earns its place

`app:bootstrap_complete` carries `total_ms`, `outcome`, `phase_count`,
`phases`, and `pending`. Custom timings cannot express `outcome` or `pending`,
and per-phase events cannot be percentiled without a fifteen-row join. This row
is what makes "how many users hit a slow load" a single query.

**Cardinality is one to two rows per startup attempt, not per Datadog
session.** An attempt that finishes normally emits exactly one terminal row.
An attempt still running at the watchdog deadline emits a `timed_out` row first
and then its terminal row if it ever finishes, so it contributes two. An
attempt that never finishes contributes only the `timed_out` row.

A Datadog session can span multiple page loads and startup attempts. Its
`session.id` groups those attempts; it does not identify one attempt.

Queries must therefore select an outcome rather than counting rows:

| Question                                   | Filter                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| How long did a startup attempt take        | `@context.outcome:(completed OR failed)` — one row per finished attempt |
| How many attempts exceeded 30 seconds      | `@context.outcome:timed_out` — one row per affected attempt             |
| How many RUM sessions contained an overrun | `@context.outcome:timed_out`, counted by distinct `session.id`          |

An undifferentiated row count double-counts every attempt that emits both a
watchdog row and a terminal row. A distinct `session.id` count answers how many
RUM sessions were affected, not how many startup attempts or users were
affected.

### Outcomes are recorded so the bad sessions survive

`outcome` distinguishes `completed`, `failed`, and `timed_out`. A watchdog
emits a `timed_out` row at 30 s naming the phases still open, in addition to
whichever terminal row eventually follows. Without it a load that hangs
produces no data at all, so the sessions users complain about would be exactly
the ones absent from every percentile.

`setViewLoadingTime()` is called only for `completed`. A failed startup has
not loaded, and a fast failure folded into the same field would drag the
loading-time percentiles down. Failures are counted through the action's
`outcome` facet instead.

### Datadog is reached directly; PostHog through the registry

ADR-TELEMETRY-ROUTING-0013 routes dual-emission through `TelemetryRegistry`.
This signal
deviates for Datadog only: the registry does not exist during early startup,
which is precisely when the signal matters. `bootstrapTracer.ts` sits under
`src/platform/telemetry/**`, which `no-restricted-imports` permits to import
the sinks behind an explicit disable comment.

PostHog receives bootstrap rows through the registry, preserving that ADR's
split: Datadog for alerting, PostHog for exploration. The two sinks are not
symmetric here. Rows emitted before `initTelemetry()` resolves are
Datadog-only, because the registry does not exist yet to dispatch them — in
practice a `timed_out` row from a session that stalled inside
`startup/remote-config` or `startup/telemetry-init`. Datadog is the complete
record of startup outcomes; PostHog is complete only for sessions that got
past telemetry init.

## Consequences

### Positive

- "How many users hit a slow load, and where did the time go" is one Datadog
  query rather than an investigation.
- Loads that hang or throw are represented, so percentiles are not computed
  over survivors.
- Phase boundaries and loading time use fields Datadog charts natively, so
  monitors can be built without first building a dashboard.
- The dynamic-provider-import fallback introduced in #14079 is removed; the
  SDK's own buffer covers the window it was working around.

### Negative

- `setViewLoadingTime()` is marked `[Experimental]` in `@datadog/browser-rum`
  6.33.0. If its behavior changes, `@view.loading_time` is affected;
  `@context.total_ms` is the unaffected fallback and is
  deliberately retained rather than deduplicated away.
- Custom timings attach to the view current when recorded, and loading time is
  measured from that view's start. A route change during startup, such as the
  login redirect, splits the timing series across views and makes
  `@view.loading_time` cover only the final view segment. The aggregate action
  carries the complete series and total and is the system of record.
- Emitting to Datadog directly rather than through the registry means a future
  sink added to the registry does not automatically receive this signal.
- Datadog and PostHog will disagree on volume, as ADR-TELEMETRY-ROUTING-0013
  already notes for every dual-emitted event, and additionally here because
  pre-registry rows never reach PostHog. Build monitors on rates, not absolute
  counts, and build them on Datadog.

### Neutral

- This lane's numbers are not comparable to an ADR-PERF-BENCHMARKS-0022
  benchmark sample:
  real sessions have no controlled execution identity. It is not a CI gate. A
  regression surfaced here is reproduced in the lab lane before it is acted on.

## Alternatives considered

**Route Datadog through `TelemetryRegistry` like every other event.** Rejected
because the registry is null for the part of startup this exists to measure.
#14079 demonstrated the workaround this forces — a conditional dynamic import
of one provider — which is strictly worse than importing the sink in the
telemetry layer that is already allowed to.

**Emit only the aggregate action, no native timings.** Rejected: it puts every
phase behind a hand-built dashboard when `@view.custom_timings` and
`@view.loading_time` are already charted, and it discards RUM's correlation of
loading time with Core Web Vitals.

**Emit only native timings, no aggregate action.** Rejected: timings cannot
express `outcome` or `pending`, cannot provide one complete series across a
mid-startup route change, and cannot answer the affected-user-count question
that motivated the work.

**Use `addDurationVital` for the page load.** Rejected as redundant with
`view.loading_time` and a misuse of a primitive meant for discrete in-view
operations.

**Extend ADR-PERF-BENCHMARKS-0022's harness to production.** Rejected: it
depends on a fixed
execution identity — pinned browser, runner image, GPU, viewport — that real
sessions do not have.

## Notes

- Follow-up to [#14079](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14079).
- Related: [ADR-TELEMETRY-ROUTING-0013](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md),
  [ADR-PERF-BENCHMARKS-0022](PERF-BENCHMARKS-0022-performance-evidence-and-regression-framework.md).
- Known gaps, deliberately out of scope: `auth-gate/initialized` remains one
  span around `waitForCloudAuth`, hiding a 16 s timeout and a 3 s retry sleep;
  and nothing here separates network time from script time within a phase, so
  it does not settle whether serialized bootstrap or sequential chunk loading
  dominates. A `performance.getEntriesByType('resource')` roll-up on the
  aggregate row would.
