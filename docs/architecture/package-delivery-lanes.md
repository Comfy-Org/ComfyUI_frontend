# Package delivery lanes

A package delivery lane lets one part of the monorepo choose its own balance of speed and rigor
without weakening the rest of the repository. A lane has four independent stages:

1. **Scope:** decide whether every changed path belongs to the package.
2. **Quality:** run the package's checks instead of unrelated repository checks.
3. **Approval:** apply the package's reviewed approval policy to the exact commit.
4. **Delivery:** use the repository's normal merge, deployment, and rollback systems.

The website is the first lane. The approval engine in the `tools/cicd/fast-lane/` workspace is package-neutral;
the change classifier output, the scoped CI jobs, and the workflow are per lane.

## The dials a package owns

Each lane has a JSON policy in `.github/fast-lanes/`. A policy change receives normal repository
review, so changing a dial is visible in history.

| Dial                       | Meaning                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `pathPrefixes`             | The complete set of paths the lane is allowed to change.                                     |
| `approval.identity`        | The GitHub account whose token posts policy approvals; verified before the lane acts.        |
| `approval.trustedAuthors`  | Authors who may receive a policy approval without an operator label.                         |
| `approval.approvalLabel`   | An explicit opt-in route for other authors.                                                  |
| `approval.trustedLabelers` | Operators allowed to apply that label.                                                       |
| `approval.holdLabel`       | Stops the lane at its next run: dismisses lane approvals and disarms lane-owned merge state. |
| `merge.mode`               | `automatic` arms native auto-merge or the queue; `manual` stops after approval.              |
| `merge.method`             | The repository-supported merge method used by automatic mode.                                |

Package-specific quality commands remain in the package's CI jobs. The first routing rule is
simple: a package-only pull request runs that package's checks; a mixed or root-level pull request
runs the full repository checks. Merge-group and protected-branch runs remain full-repository checks
unless a later change proves that a narrower candidate calculation is safe.

## Fixed safety rules

These are implementation invariants, not package dials:

- The workflow and policy are checked out from the protected default branch. Pull request code is
  never executed by the approval workflow.
- Forks, drafts, non-default base branches, stale event heads, incomplete file lists, and paths
  outside the lane fail closed.
- Every approval is tied to the exact head SHA. A new commit needs a new policy decision.
- Approval-label provenance is bound to the current workflow event. A non-allowlisted author is
  eligible only on the exact-head `labeled` event from a trusted operator; later events continue
  while that same head has the policy approval and the label remains applied. Removing the label
  withdraws the approval. Commit timestamps are never used as a proxy for push order.
- An active human change request blocks the lane. Comments and pending reviews do not count as
  change requests.
- The credential's GitHub identity must match the identity declared in the policy, and it cannot
  approve its own pull request.
- If verification or arming fails after the policy approval, every active policy approval is
  dismissed. A run whose event head is no longer the pull request head changes nothing; the
  repository ruleset dismisses approvals of older heads on push, and the run for the new head
  decides again.
- Fast-lane runs for one pull request share a concurrency group, so at most one runs at a time and
  GitHub keeps only the newest pending run. Hold and label-removal runs are safe to lose because
  every run reads the live labels; a pending `labeled` approval run is not, and the operator
  re-runs it or re-applies the label. Compensation attempts merge-state teardown and each active
  policy-approval dismissal separately, so one failed API call does not skip the others.
- The lane disables only auto-merge or queue state that its identity enabled at or after its first
  policy review on the pull request. Because the identity is a personal account, that includes the
  account owner's own merge actions in that window.

The reusable TypeScript engine lives in `tools/cicd/fast-lane/src/`. `policy.ts` contains pure policy
decisions, `github.ts` contains GitHub transport, and `automation.ts` owns the approval and merge
lifecycle. Behavioral tests run `runFastLane` against an in-memory GitHub double and cover each
fixed rule.

## Adding a lane

1. Add a reviewed policy file under `.github/fast-lanes/`.
2. Add a package-only output to the change classifier (`.github/actions/changes-filter`) and a
   test that ties it to the policy's `pathPrefixes`.
3. Add package-scoped lint, format, typecheck, test, and repository checks behind that result. Keep
   the full checks as the fallback for mixed changes.
4. Add a workflow like `pr-website-auto-approve.yaml`: `pull_request_target`, `status`, and
   `workflow_run` triggers; a resolver job that finds the pull request; and one lane job keyed on
   that pull request's concurrency group. The lane job sparse-checks out `.nvmrc`, the selected
   policy, and `tools/cicd/fast-lane/` from the default branch (cone mode also includes
   root-level files) and runs `node tools/cicd/fast-lane/src/run.ts` without installing
   dependencies.
5. Put the approval credential in a package-specific protected environment and restrict that
   environment to the protected default branch.
6. Add negative tests for forks, mixed paths, stale heads, self-approval, unauthorized labels,
   active change requests, and post-approval failure.
7. Trial the lane with a disposable pull request. Record time from update to checks, approval,
   queue entry, production identity, and rollback readiness before expanding its allowlist.

This process changes package policy, not the repository's underlying protection model. A package
can start with fast feedback and a narrow allowlist, then tighten or relax individual dials using
evidence from its own delivery times and failures.
