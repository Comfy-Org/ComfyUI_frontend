# ADR-009: Fail closed — validate the whole op before any mutation

**Status:** Accepted
**Date:** 2026-09-21
**Invariants:** KA-4
**Issue:** #228

## Context

`docs/INVARIANTS.md` KA-4 already states, at the invariant level, that the applier is
deterministic and idempotent: preconditions are checked before the first mutation, a rejected op
leaves the document untouched (byte-identical `encodeStateAsUpdate`), and a rejected op does not
consume its `op_id`, so a caller can retry it unchanged. That rule has never been written down as
a general, ADR-level decision. It exists only split across three places, each narrower than the
rule itself:

- KA-4 states it as an applier invariant, enforced by tests, not as a decision with rationale and
  alternatives.
- [ADR-003](ADR-003-catalog-sha-at-mint.md) states the "no guessing" half of this rule, but scopes
  it to catalog widget-name matching only: "Widget writes to uncatalogued classes fail closed and
  loudly," rejected as an alternative to "guess unknown widget layout... because silent mis-keying
  is worse than a loud failure."
- [ADR-007](ADR-007-discriminated-apply-outcomes.md) touches op rejection only as an outcome-shape
  concern, and explicitly disclaims changing this rule: "Op classification and mutation semantics
  remain unchanged; only reporting changes."

No document states the rule generally, for every graph op, independent of catalog lookups or
outcome reporting. PR #228 shows why that gap is not hypothetical. `applier.ts`'s
`validateWidgetName` accepted a dotted `set_widget` name (e.g. `mode.skin_detail`) as a "plausible
dynamic-combo sub-field write" whenever its prefix (`mode`) was a real catalogued widget of the
node's class, even though the catalog could not confirm the suffix was real (`EXCEPTIONS.md`,
KA-12, 2026-09-20). That guess let the write through: it mutated document state and consumed the
op's `op_id`, and the accepted value made the whole document unprojectable, not merely the one
widget. The fix in PR #228 tightened validation back to exact catalog membership and added
`test/mint-dynamic-combo-catalog-mismatch.test.ts` plus regression coverage asserting
byte-identical `Y.encodeStateAsUpdate` and that `op_id` is not consumed on rejection. The gap the
incident exposed was not specific to catalog lookups; it was a validation path, outside ADR-003's
narrower scope, that accepted a partially-guessed op. `connect` is the motivating general case:
it touches the link tuple plus both endpoint slot references in one logical edit, and those three
writes must succeed or fail together, not split into a partially-applied edge.

## Decision

Every graph op is validated as a whole, before any document mutation, regardless of which op type
it is or which specific check would reject it:

- **No partial application.** An op either applies its full effect in one transaction or leaves
  the document exactly as it was. There is no state where some of an op's writes landed and
  others did not, and no "best-effort" application of a partially-valid op.
- **No guessing.** Validation must never accept an op by inferring, guessing, or pattern-matching
  a part of it that cannot be confirmed against the authoritative source (the catalog, the current
  document state, or the op's own declared shape). An unconfirmable part is a rejection, not a
  plausible default.
- **Rejection is total, not partial.** When an op is rejected, the document state and the
  operation ledger are byte-identical to their pre-attempt values, and the op's `op_id` is not
  recorded as applied. The op is therefore retryable unchanged: a caller (including an agent) that
  resubmits the exact same op after a rejection is doing the correct thing, not working around a
  bug.

This generalizes ADR-003's catalog-specific "no guessing" clause to every graph op and every kind
of validation failure, not only catalog/widget-name mismatches. It formalizes, at ADR level, the
rule KA-4 already states as an invariant.

This decision does not change ADR-007's outcome-reporting shape, and it does not touch multi-op
batch semantics. Today, when a batch of ops is submitted and one op is rejected, only the
remaining (not-yet-processed) ops in that batch are rejected with it; already-applied ops in the
batch keep their effect. Making batch submission fully transactional (all-or-nothing across the
whole batch) is a separate, more disruptive question — it would require producers to submit only
mutually-commutative or fully-independent ops, or accept that a late failure discards otherwise
valid earlier work — and is explicitly out of scope here. ADR-007's abort-remainder behavior is
unchanged by this ADR.

## Consequences

- The single-op contract (validate whole, mutate atomically, reject without residue, never
  consume `op_id` on rejection) is now a stated decision with rationale, not only an invariant
  enforced by tests and scattered ADR-scoped clauses.
- A validation check for any new op type must be written to confirm its inputs against an
  authoritative source before writing, not to accept a plausible-looking but unconfirmed guess.
  Reviewers can point at this ADR instead of re-deriving the rule from KA-4 and ADR-003 each time.
- ADR-003 remains the authority for the catalog-specific case; this ADR is the general rule it is
  an instance of. Neither document needs to restate the other's scope.
- ADR-007 remains the authority for outcome-reporting shape and for abort-remainder batch
  semantics; this ADR does not reopen either.
- No code change accompanies this ADR. `validateWidgetName` and the KA-4 test suite
  (`test/ka4-rejection-byte-identity.test.ts`, `test/reject-no-mutation.regression.test.ts`,
  `test/opid-payload-reuse.regression.test.ts`) already enforce the rule this ADR names; this ADR
  gives that enforcement a citable decision record.

## Alternatives considered

- **Leave the rule split across KA-4, ADR-003, and ADR-007.** Rejected: PR #228 was a real
  violation that fell outside ADR-003's catalog-only scope and ADR-007's reporting-only scope,
  which shows the split leaves gaps rather than merely duplicating text.
- **Make multi-op batches fully transactional (abort the whole batch, not just the remainder, on
  any failure).** Rejected for this ADR by explicit decision: it would require agents to submit
  perfectly commutative or independent ops, is a significant user-facing behavior change from
  today's abort-remainder semantics, and is a separate question from the single-op contract this
  ADR states. ADR-007's abort-remainder behavior stands as-is.
- **Scope this rule to `connect` only, since that is the motivating multi-part op.** Rejected: the
  PR #228 incident that motivated writing this down was a `set_widget` validation gap, not a
  `connect` gap, so scoping to one op type would repeat ADR-003's mistake of a narrower-than-needed
  rule.
