# ADR-CI-ROLLOUT-0031: Advisory Feature Flag Policy

Date: 2026-09-15

## Status

Proposed

## Context

Feature-flag advice needs to respect the team's risk classification and its
named dispute labels. An independent path classifier would create a second
source of truth. Conversely, publishing failed GitHub checks would feed policy
failures into the risk grader's CI-health input and could keep a PR classified
as high risk because its flag declaration is missing.

## Decision

Use effective risk labels, including named risk-dispute overrides, to determine
whether a flag declaration is expected. A maintainer can acknowledge a flag
exception with `flag-dispute` and a rationale in the PR description.

Represent policy PASS/FAIL in the check title while retaining a neutral GitHub
conclusion for every outcome. Keep the check optional. A declaration or label
records a review decision; it does not verify production rollout safety.

Reuse the read-only request and trusted publisher split. The risk workflow
uploads PR/head metadata after grading so bot-applied labels refresh advice
without relying on suppressed label events. Manual batch requests are accepted
only from the default branch. Do not grant workflow-dispatch write permissions
for this handoff.

## Consequences

### Positive

- Risk classification has one owner; contributors can use existing disputes.
- Policy failures neither block merges nor create CI-driven risk feedback.
- Fork PRs retain a read-only request path; privileged code comes from the
  default branch and reads live PR data.

### Negative

- A high-risk docs or test PR needs a flag exception or a risk correction.
- Human reviewers must assess exception quality and actual flag containment.
- Labels can precede the latest grade, and publication cannot atomically read
  inputs and create a check. Advice can briefly be stale until a refresh.
- A red failed-check presentation would require a separate design that excludes
  the policy from risk-grading inputs and preserves optional merge behavior.
