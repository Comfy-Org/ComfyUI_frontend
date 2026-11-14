# ADR-TELEMETRY-ERRORS-0030: Agent-Consumable Error Telemetry

Date: 2026-09-03

## Status

Proposed

Three parts of this decision are not expressible with the current emitters.
Rule 5 selects soft, hard, and sampled assertion modes, but
`assert(condition, message, context)` has no mode or taxonomy-tag input. Its
desktop reporter calls Sentry `captureMessage` directly, while the cloud
reporter emits `invariant_assert` without taxonomy tags and caps repeated and
distinct messages. Rule 4 configures a fingerprint at the emitter, but
`ReportErrorOptions` has no fingerprint field. This stays Proposed until
assertion mode, assertion taxonomy tags, and emitter fingerprints are supported.

## Context

Real-user state exposes failures that tests and pre-deploy checks cannot see:
invariants, bad user states, expected-but-missing events, unexpected catches,
and degraded paths. These signals need common tags so agents can query them by
alert family and Datadog RUM can route alerts without one monitor per error
slug.

The frontend already provides `reportError`, mandates it in `src/AGENTS.md`,
and has production callers using snake_case `errorType` slugs and product
`surface` values. `src/base/assert.ts` is used much less widely, while many
catch blocks remain. The gap is coverage and discipline, not another reporting
API. Counts are deliberately omitted because they change independently of this
decision.

The tradeoffs considered were bounded indexed tags versus diagnostic context,
default grouping versus explicit fingerprints, family-level alerting versus
per-slug alerts, and failure counts versus rates with denominators. Those
tradeoffs lead to the low-cardinality tags and alternatives recorded below.

[ADR-TELEMETRY-DIAGNOSTICS-0019](TELEMETRY-DIAGNOSTICS-0019-recoverable-event-diagnostics.md)
proposes one diagnostics system and defers its concrete API while requiring
existing `reportError` infrastructure to be reused or evolved. This ADR narrows
that direction for error telemetry by defining tags for `reportError` and
`assert`; it does not add a second reporting path.

## Decision

1. **Keep `reportError` and `assert` as the only emitters.** Do not add another
   abstraction. Widen coverage by converting swallowed or unexpected catches
   to `reportError`, adding soft assertions at invariant boundaries, and
   emitting `missing_event` observations where expected completion has a
   bounded window.
2. **Use a fixed snake_case tag taxonomy:**
   - `error_type`: written by `reportError` from `errorType`; a stable slug
     shaped as `<category>_<operation>_<subject>[_detail]`, with the operation
     written as a present participle
   - `surface`: written by `reportError` from the required product owner in
     `ReportErrorOptions`
   - `failure_kind`: `invariant`, `bad_state`, `missing_event`,
     `caught_unexpected`, or `degraded`
   - `feature_area`: `workflow`, `queue`, `canvas`, `nodes`, `auth`, `cloud`,
     `agent`, `crdt`, `billing`, `extensions`, `settings`, or `assets`
   - `operation`: `load`, `save`, `execute`, `sync`, `import`, `export`,
     `render`, `navigate`, `auth`, or `insert`
   - `outcome`: `failed`, `recovered`, `aborted`, `timed_out`, `missing`, or
     `degraded`
   - `assert_mode`: `soft`, `hard`, or `sampled` for assertions

   `surface` identifies who owns the response; `feature_area` identifies the
   failing product area used by alert families. The outcomes mean:
   - `failed`: the requested work did not complete and no fallback ran.
   - `recovered`: the requested work completed after recovery.
   - `aborted`: the requested work stopped safely without applying its result.
   - `timed_out`: a bounded wait expired.
   - `missing`: an expected event did not arrive.
   - `degraded`: work continued with reduced data or capability.

   A conforming event always supplies `failure_kind`, `feature_area`, and
   `outcome`. It supplies `operation` when the failure occurs during one of the
   enumerated operations; invariants and bad states with no discrete operation
   omit it. An assertion event is an `invariant` or `bad_state` check reported
   with assertion semantics, including a semantic soft assertion emitted
   through `reportError` instead of `assert()`. Assertion events supply
   `assert_mode`; non-assertion events omit it. Existing taxonomy-tagged
   emitters with other values or with `assert_mode` on non-assertion events do
   not conform; reconcile them before acceptance. `ReportErrorOptions.tags`
   remains optional for existing callers, but an event does not conform to
   this taxonomy unless its tags satisfy this record shape.

   Rule 2's lists are authoritative. After acceptance, add a value there and
   append its audit record under Registry Amendments. Dynamic values such as
   ids, names, and paths are forbidden in tags; permitted diagnostic values
   belong in `context`. Other bounded snake_case tags may accompany these keys,
   but monitors must not require them.

3. **Choose levels by impact.** Use `error` for `invariant`, `bad_state`,
   `caught_unexpected`, and `outcome:failed`. Use `warning` for
   `failure_kind:degraded`, `outcome:degraded`, `outcome:recovered`, and
   `missing_event` unless the user lost work. When multiple rules match,
   `error` takes precedence over `warning`.
4. **Retain default grouping unless a slug must subdivide an issue.** Sentry's
   default grouping ignores tags, including `error_type`. When separate issues
   are needed per slug, configure an emitter fingerprint containing both
   `{{ default }}` and `errorType`. Never use a bare `[errorType]` fingerprint,
   and do not add taxonomy fingerprints globally in `beforeSend`, so each
   override stays reviewable at its call site.
5. **Use soft assertions by default in the browser.** Hard assertions are only
   for cases where continuing corrupts document or CRDT state, authentication,
   or billing. Sampled assertions are only for render and pointer hot paths and
   never for data-loss invariants. Assertion messages are static strings.
6. **Classify every touched catch.** A catch is expected-handled,
   degraded-recovered, unexpected, or rethrown. Only degraded-recovered and
   unexpected catches report. A degraded-recovered catch reports
   `failure_kind:degraded`; an unexpected catch reports
   `failure_kind:caught_unexpected`. `outcome` records what happened to the
   requested work. Never report and rethrow the same error.
7. **Do not include PII.** Prompts, workflow names or paths, file names, node
   titles, emails, and tokens are forbidden in tags and context. Limit context
   to ids, counts, enums, and booleans. Before acceptance, update the
   `src/AGENTS.md` guidance that permits filenames and URLs in context.
8. **Route operational alerts through Datadog by family.** Following
   [ADR-TELEMETRY-ROUTING-0013](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md),
   use one RUM monitor per family rather than per slug:
   - new invariant: `failure_kind:invariant`
   - hard assertion: `assert_mode:hard`
   - broken user operation: `outcome:failed` with `operation`
   - unexpected catch: `failure_kind:caught_unexpected`
   - missing completion: `failure_kind:missing_event`
   - failure-rate deviation: `outcome:failed` divided by the paired success
     actions from rule 9, grouped by `feature_area` and `operation`
   - feature-area anomaly: conforming events grouped by `feature_area`
   - recovered-degradation digest: `failure_kind:degraded` with
     `outcome:recovered` or `outcome:degraded`

   Sentry remains an error exploration and grouping sink, not the operational
   alert route.

9. **Add denominators in a later phase.** Paired Datadog RUM success actions
   should use the same bounded attributes as these error tags so Datadog
   calculated metrics and monitors can measure failure rates.
10. **Keep this decision frontend-scoped.** Backend telemetry transports need
    their own amendment before adopting this taxonomy.

## Consequences

### Positive

- Sentry issues become queryable by agents using stable tag conjunctions such
  as `failure_kind:invariant feature_area:workflow release:X`.
- `feature_area` becomes shared vocabulary for error tags, future metric
  attributes, and operational follow-up.
- Instrumentation changes stay small and reviewable: one feature area or catch
  cluster per pull request, with no behavior change to recovery paths.

### Negative

- Event volume rises, so alert families and existing filtering must keep noisy
  deployment and chunk-load failures out of these signals.
- Tags remain untyped, so conformance depends on review until emitters enforce
  the taxonomy.
- Existing nonconforming emitters must be migrated before the ADR is accepted.

## Alternatives Considered

- A new `reportInvariant()` or `Telemetry` wrapper was rejected because it
  duplicates `reportError`, which already fans out to every configured sink.
- Kebab-case tags were rejected because existing slugs use snake_case.
- One Datadog monitor per `error_type` was rejected because it creates an
  unbounded rule count and alert fatigue.
- A bare `[errorType]` fingerprint was rejected because it merges distinct root
  causes.
- Global sampling was rejected because it can discard the rare invariants this
  decision is intended to expose.
- Sentry-only alerting was rejected because accepted
  [ADR-TELEMETRY-ROUTING-0013](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md)
  assigns low-latency incident response to Datadog RUM and monitors.

## Registry Amendments

After acceptance, append `YYYY-MM-DD tag=value — reason — PR` lines here.

## References

- [`reportError`](../../src/platform/telemetry/reportError.ts)
- [`assert`](../../src/base/assert.ts)
- [Sentry tags](https://docs.sentry.io/platforms/javascript/enriching-events/tags/)
- [Sentry event grouping](https://docs.sentry.io/concepts/data-management/event-grouping/)
- [Google SRE: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [TigerBeetle assertion guidance](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md)
- [ADR-TELEMETRY-DIAGNOSTICS-0019: Recoverable Event Diagnostics](TELEMETRY-DIAGNOSTICS-0019-recoverable-event-diagnostics.md)
- [ADR-TELEMETRY-ROUTING-0013: Telemetry Routing Across Consumers](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md)
