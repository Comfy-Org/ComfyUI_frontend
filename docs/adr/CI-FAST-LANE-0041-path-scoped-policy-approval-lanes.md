# ADR-CI-FAST-LANE-0041: Path-Scoped Policy Approval Lanes

Date: 2026-10-08

## Status

Proposed

## Context

Website changes live in this monorepo, so a copy edit under `apps/website/` waits for the same
full-repository checks and human review as a change to the editor. The website's owners want to
ship website-only changes on their own timeline without weakening the safeguards for the rest of
the repository.

The `main` ruleset requires one approval, a `comfy_website_devs` approval for `apps/website/**`,
and the `lint-and-format`, `test`, `e2e-status`, and `website-e2e` checks. It dismisses stale
approvals on push and merges through the native merge queue.

## Decision

Introduce path-scoped delivery lanes, starting with the website:

- Each lane has a reviewed JSON policy under `.github/fast-lanes/` that names its path prefixes,
  trusted authors, operator label, trusted labelers, hold label, and merge mode.
- A website-only pull request runs website-scoped lint, format, typecheck, unused-code, and locale
  checks inside the existing `lint-and-format` context. Mixed pull requests and merge-queue
  candidates keep the full checks.
- `pr-website-auto-approve.yaml` runs `scripts/cicd/fast-lane/` from the default branch. For an
  eligible same-repository pull request whose complete changed-file set is inside the lane, it
  posts a policy-only approval bound to the exact head with a credential held in a
  `main`-restricted environment, then arms native auto-merge or enters the queue. Every later run
  re-reads live state and withdraws lane-owned approvals and merge state when the pull request
  stops being eligible.
- A non-allowlisted author is eligible only on a trusted operator's `labeled` event for the
  current head, and stays eligible only while the label remains applied.
- CodeRabbit skips `apps/website/**` for the trial; human change requests still block the lane.
- Website production deploys are staged, verified through `/__build.json`, then promoted; a
  manual workflow validates or performs rollback.

### Alternatives not chosen

- **A GitHub App or bot identity instead of a personal token.** The trial uses an identity whose
  team membership already satisfies the website review rule; moving to an App identity needs that
  rule changed first.
- **A ruleset bypass list or CODEOWNERS change.** Either removes review for whole paths instead of
  binding each approval to a policy decision on an exact head that can be withdrawn.
- **Keeping CodeRabbit on website files with `request_changes_workflow` disabled.** Its change
  requests would still need a human to clear them on every website pull request.
- **Label freshness from timeline order.** Commit timeline entries carry author-controlled dates,
  so a backdated push could sort before an older label.
- **One global concurrency group, or groups keyed by commit SHA.** A global group lets unrelated
  pull requests cancel a pending hold or label run; SHA-keyed groups let two runs approve and
  withdraw the same pull request at once. Runs are grouped per pull request instead.

## Consequences

### Positive

- A trusted author's website-only change can reach the merge queue without waiting for a human
  reviewer, and every approval is tied to one head and can be withdrawn.
- The rest of the repository keeps its checks, review rule, and merge queue unchanged.
- Another package can add a lane with its own policy, classifier output, and scoped checks.

### Negative

- No human reviews a fast-laned diff, and `apps/website/**` includes build configuration and code
  that the production build runs with deployment secrets.
- Policy approvals come from a personal account; that account's own manual merge actions after its
  first policy review are treated as lane-owned.
- GitHub keeps only the newest pending run per concurrency group, so a pending `labeled` run can be
  cancelled by another event on the same pull request; the operator re-runs it or re-applies the
  label.
- The trial adds a workflow, an engine, and a rollback procedure that operators must maintain.

## Notes

- Engine and operator model: [Package delivery lanes](../architecture/package-delivery-lanes.md).
- Trial runbook: [Website delivery validation](../architecture/website-delivery-validation.md).
