# Package delivery lanes

A package delivery lane lets one part of the monorepo choose its own balance of speed and rigor
without weakening the rest of the repository. A lane has four independent stages:

1. **Scope:** decide whether every changed path belongs to the package.
2. **Quality:** run the package's checks instead of unrelated repository checks.
3. **Approval:** apply the package's reviewed approval policy to the exact commit.
4. **Delivery:** use the repository's normal merge, deployment, and rollback systems.

The website is the first lane. The implementation is deliberately package-neutral so another
package can use the same engine with a different checked-in policy.

## The dials a package owns

Each lane has a JSON policy in `.github/fast-lanes/`. A policy change receives normal repository
review, so changing a dial is visible in history.

| Dial              | Meaning                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| `pathPrefixes`    | The complete set of paths the lane is allowed to change.                        |
| `trustedAuthors`  | Authors who may receive a policy approval without an operator label.            |
| `approvalLabel`   | An explicit opt-in route for other authors.                                     |
| `trustedLabelers` | Operators allowed to apply that label.                                          |
| `holdLabel`       | An immediate stop for the lane.                                                 |
| `merge.mode`      | `automatic` arms native auto-merge or the queue; `manual` stops after approval. |
| `merge.method`    | The repository-supported merge method used by automatic mode.                   |

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
- If post-approval verification fails, the newly created approval is dismissed.
- Approval, queue, and compensation runs are serialized. Compensation attempts merge-state
  teardown and every active policy-review dismissal independently so one API failure cannot skip
  the other safety action.
- The lane only disables auto-merge or queue state that its own identity created after its policy
  approval. It does not undo another person's merge decision.

The reusable TypeScript engine lives in `scripts/cicd/fast-lane/`. `policy.ts` contains pure policy
decisions, `github.ts` contains GitHub transport, and `automation.ts` owns the approval and merge
lifecycle. Behavioral tests cover the fixed rules independently of a live repository.

## Adding a lane

1. Add a reviewed policy file under `.github/fast-lanes/`.
2. Teach the change classifier to recognize the package-only path set.
3. Add package-scoped lint, format, typecheck, test, and repository checks behind that result. Keep
   the full checks as the fallback for mixed changes.
4. Add a thin `pull_request_target` workflow that checks out only `.nvmrc`, the selected policy,
   and `scripts/cicd/fast-lane/` from the default branch. Run `run.ts` with Node's TypeScript
   stripping; do not install pull request dependencies.
5. Put the approval credential in a package-specific protected environment and restrict that
   environment to the protected default branch.
6. Add negative tests for forks, mixed paths, stale heads, self-approval, unauthorized labels,
   active change requests, and post-approval failure.
7. Trial the lane with a disposable pull request. Record time from update to checks, approval,
   queue entry, production identity, and rollback readiness before expanding its allowlist.

This process changes package policy, not the repository's underlying protection model. A package
can start with fast feedback and a narrow allowlist, then tighten or relax individual dials using
evidence from its own delivery times and failures.
