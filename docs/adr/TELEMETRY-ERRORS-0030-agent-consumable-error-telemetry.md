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
query them by family and Sentry can route useful alerts without creating one
rule per error slug.

The frontend already provides `reportError` and mandates it in
`src/AGENTS.md`; 33 snake_case `errorType` slugs exist across 29 files.
`src/base/assert.ts` is used much less widely, while hundreds of catch blocks
remain. The gap is coverage and discipline, not another reporting API.

## Decision

1. **Keep `reportError` and `assert` as the only emitters.** Do not add another
   abstraction. Widen coverage by converting swallowed or unexpected catches
   to `reportError`, adding soft assertions at invariant boundaries, and
   emitting `missing_event` observations where expected completion has a
   bounded window.
2. **Use a fixed snake_case tag taxonomy:**
   - `error_type`: existing stable slug shaped as `<area>_<what>_<how>`
   - `failure_kind`: `invariant`, `bad_state`, `missing_event`,
     `caught_unexpected`, or `degraded`
   - `feature_area`: `workflow`, `queue`, `canvas`, `nodes`, `auth`, `cloud`,
     `agent`, `crdt`, `billing`, `extensions`, `settings`, or `assets`
   - `operation`: `load`, `save`, `execute`, `sync`, `import`, `export`,
     `render`, `navigate`, or `auth`
   - `outcome`: `failed`, `recovered`, `aborted`, `timed_out`, or `missing`
   - `assert_mode`: `soft`, `hard`, or `sampled` for assertions

   New enum values require an entry under Registry Amendments. Dynamic values
   such as ids, names, and paths are forbidden in tags; permitted diagnostic
   values belong in `context`.

3. **Choose levels by impact.** Use `error` for `invariant`, `bad_state`,
   `caught_unexpected`, and `outcome:failed`. Use `warning` for `degraded`,
   `outcome:recovered`, and `missing_event` unless the user lost work.
4. **Retain default grouping.** The default fingerprint plus the stable slug
   subdivides issues without merging distinct causes. Never use a bare
   `[errorType]` fingerprint. Configure a fingerprint at the emitter when one
   is needed, not globally in `beforeSend`, so it remains reviewable.
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
8. **Route alerts by family.** Use one Sentry rule per family rather than per
   slug: new invariant, hard assertion, broken user operation, unexpected
   catch, missing completion, failure-rate deviation, dynamic anomaly by
   feature area, and a recovered-degradation digest.
9. **Add denominators in a later phase.** Paired success counters should use
   Sentry Application Metrics with the same attribute names as these tags so
   deviation alerts have a denominator.
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
- One Slack alert per `error_type` was rejected because it creates an
  unbounded rule count and alert fatigue.
- A bare `[errorType]` fingerprint was rejected because it merges distinct root
  causes.
- Global sampling was rejected because it can discard the rare invariants this
  decision is intended to expose.
- Datadog-first instrumentation was rejected because Sentry already receives
  frontend errors and supports the intended query and alert path.

## Registry Amendments

Append `YYYY-MM-DD tag=value — reason — PR` lines here.

## References

- [`reportError`](../../src/platform/telemetry/reportError.ts)
- [`assert`](../../src/base/assert.ts)
- [Source decision and research](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-029-agent-telemetry-tag-taxonomy.md)
- [ADR-TELEMETRY-ROUTING-0013: Telemetry Routing Across Consumers](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md)
