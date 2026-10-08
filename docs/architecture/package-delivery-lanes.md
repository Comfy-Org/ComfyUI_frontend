# Package delivery lanes

A package delivery lane lets one part of the monorepo choose its own balance of speed and rigor
without weakening the rest of the repository. A lane decides whether every changed path belongs to
the package, applies the package's reviewed approval policy to the exact commit, and then hands the
pull request to the repository's normal checks, merge queue, deployment, and rollback.

The website is the first lane. The approval engine in the `tools/cicd/fast-lane/` workspace is
package-neutral; the lane entry and the workflow are per lane.

## The dials a package owns

Each lane is an entry in `tools/cicd/fast-lane/src/lanes.ts`, written in lowercase. A policy change
receives normal repository review, so changing a dial is visible in history.

| Dial                       | Meaning                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `pathPrefixes`             | The complete set of paths the lane is allowed to change.                                     |
| `approval.identity`        | The GitHub account whose token posts policy approvals; verified before the lane acts.        |
| `approval.trustedAuthors`  | Authors who may receive a policy approval without an operator label.                         |
| `approval.approvalLabel`   | An explicit opt-in route for other authors.                                                  |
| `approval.trustedLabelers` | Operators allowed to apply that label.                                                       |
| `approval.holdLabel`       | Stops the lane at its next run: dismisses lane approvals and disarms lane-owned merge state. |

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

The reusable TypeScript engine lives in `tools/cicd/fast-lane/src/`. `lanes.ts` holds the policies,
`policy.ts` the pure policy decisions, `github.ts` the GitHub transport, and `automation.ts` the
approval and merge lifecycle. Behavioral tests run `runFastLane` against an in-memory GitHub double
and cover each fixed rule.

## Adding a lane

1. Add the lane to `tools/cicd/fast-lane/src/lanes.ts`.
2. Copy `pr-website-auto-approve.yaml` and point it at the new lane and at the workflows whose
   completion should re-run the lane.
3. Put the approval credential in a package-specific protected environment and restrict that
   environment to the protected default branch.
4. Trial the lane with a disposable pull request. Record time from update to checks, approval,
   queue entry, and production deployment before expanding its allowlist.

This process changes package policy, not the repository's underlying protection model. A package
can start with fast feedback and a narrow allowlist, then tighten or relax individual dials using
evidence from its own delivery times and failures.
