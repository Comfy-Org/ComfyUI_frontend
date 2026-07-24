/**
 * Decides which open pull requests are backports that are missing the
 * `backport` label.
 *
 * Why this exists: `pr-backport.yaml` applies the label at exactly one point —
 * the `gh pr create --label "backport"` call it makes itself. Whenever the
 * cherry-pick conflicts, that call never happens and the backport is finished
 * by hand (the workflow's own failure comment instructs a human or agent to
 * "create PR titled ... with label backport"). That handoff is easy to miss,
 * and a backport PR without the label is invisible to
 * `backport-auto-merge.yaml`, which sweeps `gh pr list --label backport`, so
 * the PR sits open until somebody notices.
 *
 * The label is therefore derived from the branch naming convention instead of
 * being trusted to whoever opened the PR.
 */

/**
 * Mirrors the branch name `pr-backport.yaml` builds for a backport:
 * `BACKPORT_BRANCH="backport-${PR_NUMBER}-to-$(echo "$TARGET" | tr '/' '-')"`.
 */
export function toSafeBranchName(branch: string): string {
  return branch.replaceAll('/', '-')
}

const BACKPORT_BRANCH_PATTERN = /^backport-\d+-to-(.+)$/

/**
 * True when `headRef` is the backport branch that `pr-backport.yaml` would
 * have generated for a backport targeting `baseRef`.
 *
 * The target encoded in the branch name must match the PR's actual base, so a
 * `backport-123-to-cloud-1.47` branch retargeted at `main` is not treated as a
 * backport.
 */
export function isBackportBranchForBase(
  headRef: string,
  baseRef: string
): boolean {
  const match = BACKPORT_BRANCH_PATTERN.exec(headRef)
  if (!match) return false
  return match[1] === toSafeBranchName(baseRef)
}

export interface PullRequestSummary {
  number: number
  headRefName: string
  baseRefName: string
  labels: { name: string }[]
}

export const BACKPORT_LABEL = 'backport'

/**
 * Returns the numbers of the PRs that are backports by branch convention but
 * do not carry the `backport` label yet.
 */
export function planBackportLabels(prs: PullRequestSummary[]): number[] {
  const needsLabel = prs.filter(
    (pr) =>
      isBackportBranchForBase(pr.headRefName, pr.baseRefName) &&
      !pr.labels.some((label) => label.name === BACKPORT_LABEL)
  )
  return [...new Set(needsLabel.map((pr) => pr.number))].sort((a, b) => a - b)
}
