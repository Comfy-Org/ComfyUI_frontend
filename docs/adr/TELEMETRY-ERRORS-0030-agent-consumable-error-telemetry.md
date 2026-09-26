# ADR-TELEMETRY-ERRORS-0030: Agent-Consumable Error Telemetry

Date: 2026-09-03

## Status

Proposed

Two rules below are not expressible with the APIs as they stand: rule 5
selects soft, hard, and sampled assertion modes, but `assert()` takes only a
condition and a message; rule 4 configures a fingerprint at the emitter, but
`ReportErrorOptions` has no fingerprint field and the only fingerprint seam
today is the global `beforeSend` that rule 4 rules out. This stays Proposed
until those two emitter APIs land, so it reads as direction rather than an
immediately-binding gate.

## Context

Real-user state exposes failures that tests and pre-deploy checks cannot see:
invariants, bad user states, expected-but-missing events, unexpected catches,
and degraded paths. These signals need intentional common tags so agents can
query them by family and Datadog RUM can route useful alerts without creating
one monitor per error slug.

The frontend already provides `reportError`, mandates it in `src/AGENTS.md`,
and has production callers using snake_case `errorType` slugs.
`src/base/assert.ts` is used much less widely, while many catch blocks remain.
The gap is coverage and discipline, not another reporting API. Counts are
deliberately omitted because they change independently of this decision.

This decision originated in a 2026-09-03 product directive to expose
invariants, bad states, missing bounded completions, unexpected catches, and
degraded paths through one queryable taxonomy. The supporting research checked
the existing frontend emitters and compared bounded indexed tags with diagnostic
context, default grouping with explicit fingerprints, family-level alerting with
per-slug alerts, and failure counts with rates that have denominators. Those
tradeoffs lead to the fixed low-cardinality tags and alternatives recorded
below; the decision does not depend on access to an external design document.

## Decision

1. **Keep `reportError` and `assert` as the only emitters.** Do not add another
   abstraction. Widen coverage by converting swallowed or unexpected catches
   to `reportError`, adding soft assertions at invariant boundaries, and
   emitting `missing_event` observations where expected completion has a
   bounded window.
2. **Use a fixed snake_case tag taxonomy:**
   - `error_type`: existing stable slug shaped as
     `<category>_<operation>_<subject>[_detail]`, with the operation written as
     a present participle
   - `failure_kind`: `invariant`, `bad_state`, `missing_event`,
     `caught_unexpected`, or `degraded`
   - `feature_area`: `workflow`, `queue`, `canvas`, `nodes`, `auth`, `cloud`,
     `agent`, `crdt`, `billing`, `extensions`, `settings`, or `assets`
   - `operation`: `load`, `save`, `execute`, `sync`, `import`, `export`,
     `render`, `navigate`, `auth`, or `insert`
   - `outcome`: `failed`, `recovered`, `aborted`, `timed_out`, `missing`, or
     `degraded`
   - `assert_mode`: `soft`, `hard`, or `sampled` for assertions

   A conforming event always supplies `failure_kind`, `feature_area`, and
   `outcome`. It supplies `operation` when the failure occurs during one of the
   enumerated operations; invariants and bad states with no discrete operation
   omit it. Assertion events also supply `assert_mode`; non-assertion events
   omit it. An assertion event is any invariant or bad-state check reported with
   assertion semantics, including a semantic soft assertion emitted through
   `reportError` instead of `assert()`. Such an event supplies
   `assert_mode:soft`. `ReportErrorOptions.tags` remains optional for existing
   callers, but an event does not conform to this taxonomy unless its tags
   satisfy this record shape.

   New enum values require an entry under Registry Amendments. Dynamic values
   such as ids, names, and paths are forbidden in tags; permitted diagnostic
   values belong in `context`.

3. **Choose levels by impact.** Use `error` for `invariant`, `bad_state`,
   `caught_unexpected`, and `outcome:failed`. Use `warning` for `degraded`,
   `outcome:recovered`, and `missing_event` unless the user lost work. When
   multiple rules match, `error` takes precedence over `warning`.
4. **Retain default grouping unless a slug must subdivide an issue.** Sentry's
   default grouping ignores tags, including `error_type`. When separate issues
   are needed per slug, configure an emitter fingerprint containing both
   `{{ default }}` and `errorType`. Never use a bare `[errorType]` fingerprint,
   and do not set fingerprints globally in `beforeSend`, so each override stays
   reviewable at its call site.
5. **Use soft assertions by default in the browser.** Hard assertions are only
   for cases where continuing corrupts document or CRDT state, authentication,
   or billing. Sampled assertions are only for render and pointer hot paths and
   never for data-loss invariants. Assertion messages are static strings.
6. **Classify every touched catch.** A catch is expected-handled,
   degraded-recovered, unexpected, or rethrown. Only degraded-recovered and
   unexpected catches report. Never report and rethrow the same error.
7. **Do not include PII.** Prompts, workflow names or paths, file names, node
   titles, emails, and tokens are forbidden in tags and context. Limit context
   to ids, counts, enums, and booleans.
8. **Route operational alerts through Datadog by family.** Following
   [ADR-TELEMETRY-ROUTING-0013](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md),
   use one RUM monitor per family rather than per slug: new invariant, hard
   assertion, broken user operation, unexpected catch, missing completion,
   failure-rate deviation, dynamic anomaly by feature area, and a
   recovered-degradation digest. Sentry remains an error exploration and
   grouping sink, not the operational alert route.
9. **Add denominators in a later phase.** Paired Datadog RUM success actions
   should use the same bounded attributes as these error tags so Datadog
   calculated metrics and monitors can measure failure rates.
10. **Keep this decision frontend-scoped.** Backend telemetry transports need
    their own amendment before adopting this taxonomy.

## Consequences

- Sentry issues become queryable by agents using stable tag conjunctions such
  as `failure_kind:invariant feature_area:workflow release:X`.
- Event volume rises, so alert families and existing filtering must keep noisy
  deployment and chunk-load failures out of these signals.
- `feature_area` becomes shared vocabulary for error tags, future metric
  attributes, and operational follow-up.
- Instrumentation changes stay small and reviewable: one feature area or catch
  cluster per pull request, with no behavior change to recovery paths.

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

Append `YYYY-MM-DD tag=value — reason — PR` lines here.

- 2026-09-13 `error_type=workflow_insert_aborted_canvas_changed` — workflow
  insertion was dropped after the canvas or graph changed while loading —
  [#17593](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17593)
- 2026-09-13 `operation=insert` — workflow insertion into an existing graph —
  [#17593](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17593)
- 2026-09-13 `outcome=degraded` — operation was dropped safely without
  user-visible corruption —
  [#17593](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17593)

## References

- [`reportError`](../../src/platform/telemetry/reportError.ts)
- [`assert`](../../src/base/assert.ts)
- [Sentry tags](https://docs.sentry.io/platforms/javascript/enriching-events/tags/)
- [Sentry event grouping](https://docs.sentry.io/concepts/data-management/event-grouping/)
- [Google SRE: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [TigerBeetle assertion guidance](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md)
- [ADR-TELEMETRY-ROUTING-0013: Telemetry Routing Across Consumers](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md)
