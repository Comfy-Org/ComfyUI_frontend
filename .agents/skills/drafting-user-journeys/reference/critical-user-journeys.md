# Critical user journeys

A critical user journey (CUJ) is a user goal plus the steps a user takes to
reach it, named from the user's side rather than by component, store, or
command. It is critical when its breakage stops users whatever feature they
came for, or loses their work. Test each candidate with one question: if this
broke tomorrow, what stops working, and for whom? The suite is meant to
protect each CUJ with one `@smoke` spec that asserts the journey's end result.

## Where the list lives

`browser_tests/JOURNEYS.md` is the list once it exists: each journey with the
spec that proves it and the observable that spec asserts. Until then, the
draft list is in "Phase 1: write the journey inventory and run it as smoke"
of `docs/testing/e2e-coverage-strategy.md`. Read whichever exists; the list
changes, and a copy goes stale.

Keep the list's order and any priority it records. The list's owners rank it
by impact; a PR keeps that ranking and its tiers.

## When a change touches one

For each CUJ the change passes through (same surface, same store, same
command), record one of these in the coverage table:

- **Unchanged**: the journey's steps and expected results still hold. Name its spec and the observable the list says it asserts; that spec passing is the evidence. A `@smoke` tag alone is not evidence, because until `JOURNEYS.md` exists many `@smoke` tests are not journeys. Open the spec and confirm it asserts the journey's end result before citing it; when it does not, record **No spec yet**.
- **Altered**: a step, label, or expected result changes. Rewrite the journey with the format in [`user-journeys.md`](user-journeys.md), update its spec in the same PR, and say in the PR body that a critical journey changed.
- **No spec yet**: no spec proves the journey's end result, so a break in it would ship unnoticed. Outline the spec as a new journey and say so in the coverage table; whether to add it in this PR is the human's call.

The check is done when every CUJ on a touched surface has one of the three.

## Proposing a new CUJ

A feature becomes a candidate when a flag flip turns it on for users, or when
its breakage would stop users who never asked for it. Before proposing it,
answer the criticality question above, and check that it is more than a step
already inside a listed journey (opening the app and loading the default
graph starts most of them). Propose it with the journey, the spec, and the
answer; adding it to the list and tagging its spec `@smoke` is a decision for
the maintainers.

Google's SRE practice also measures CUJs in production as SLIs and
dashboards. This skill covers only the pre-merge test, with no telemetry or
monitoring work.
