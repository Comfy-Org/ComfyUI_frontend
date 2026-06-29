# 11. Adopt Fallow

Date: 2026-06-29

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

We already run [knip](https://knip.dev/) in CI (the lint-format check) and in
the pre-push hook to catch unused files, exports, and dependencies. It does not
cover duplication or complexity and has no diff-aware gate.

[Fallow](https://github.com/fallow-rs/fallow) covers that wider set and adds
`fallow audit`, which compares a change against the base branch and, with
baselines, fails only on newly-introduced problems. See its docs for what each
check does.

Two repo-specific facts shape how we adopt it. The repo already carries
inherited findings (litegraph and store members kept for the extension API,
intra-lib cycles, duplicate test fixtures, a marketing file waiting on a page
that imports it); gating on those would block unrelated work. And static
analysis cannot tell intentional-but-unreferenced code from real dead code, so
build and Storybook entry points, the extension API surface, lazily-loaded
modules, build-time icon sets, and hoisted phantom deps have to be declared.

## Decision

Adopt Fallow, introduced as a stack of small PRs so each cleanup is reviewable
on its own: remove the real findings first, then record what stays. Exceptions
go in `.fallowrc.jsonc` (Fallow reads JSONC, so each entry carries a comment
explaining why it is there) and inherited findings go in `.fallow-baselines/`
under `audit.gate: new-only`, so `audit` only flags new issues. Where they
overlap, the exceptions mirror the existing knip ones. No complexity threshold
was lowered and no rule disabled; the baselines are a migration aid to shrink
and re-save as code is cleaned up, not the target state.

For now Fallow runs through the `pnpm` scripts and sits alongside knip. We have
not wired `fallow audit` into CI or the pre-push hook, and we have not retired
knip. The plan is to clear the remaining violations over time, shrinking the
baselines as we go. Once they are small enough, we gate Fallow in CI to lock in
the cleanup and stop backsliding.

## Consequences

### Positive

- Coverage knip does not have: duplication, complexity, and a diff-aware gate.
- The cleanup stack removed real unused deps, dead exports, an unused type, and
  a duplicate component.
- The new-only gate lets us adopt without first clearing the backlog.

### Negative

- Two overlapping tools until we either wire Fallow into the gates or drop knip.
- A baseline can hide a new instance of an already-baselined pattern when it
  lands in an already-baselined file; baselines need re-saving as code changes.
- Contributors have to learn which findings are real and which belong in the
  exception list.

## Notes

- Open follow-ups: declare the hoisted deps in `apps/desktop-ui/package.json`
  and drop those `ignoreDependencies` exceptions; decide whether `fallow audit`
  should run in CI or pre-push, and whether it replaces knip there.
