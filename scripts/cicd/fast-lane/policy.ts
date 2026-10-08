import type {
  FastLaneConfig,
  LabelEvent,
  PullRequest,
  PullRequestFile,
  PullRequestReview,
  RepositoryRef,
  SubmittedReview
} from './types.ts'

export const POLICY_REVIEW_PREFIX = '[Package fast lane] Policy-only approval.'

const DECISIVE_REVIEW_STATES = new Set([
  'APPROVED',
  'CHANGES_REQUESTED',
  'DISMISSED'
])

export interface EligibilityContext {
  pull: PullRequest
  reviews: PullRequestReview[]
  lane: FastLaneConfig
  repository: string
  defaultBranch: string
  labelEvent?: LabelEvent
}

export function changedPaths(files: PullRequestFile[]): string[] | undefined {
  const paths: string[] = []
  for (const file of files) {
    if (typeof file.filename !== 'string') return
    paths.push(file.filename)

    if (file.previous_filename === undefined) {
      if (file.status === 'renamed' || file.status === 'copied') return
      continue
    }
    if (typeof file.previous_filename !== 'string') return
    paths.push(file.previous_filename)
  }
  return paths
}

export function hasCompleteChangedFileList(
  files: PullRequestFile[],
  expectedCount: number | undefined
): boolean {
  return Number.isSafeInteger(expectedCount) && files.length === expectedCount
}

export function isInsideLane(paths: string[], prefixes: string[]): boolean {
  return (
    paths.length > 0 &&
    paths.every((path) => prefixes.some((prefix) => path.startsWith(prefix)))
  )
}

export function pathFailure(
  files: PullRequestFile[],
  pull: PullRequest,
  prefixes: string[]
): string | undefined {
  const paths = hasCompleteChangedFileList(files, pull.changed_files)
    ? changedPaths(files)
    : undefined
  if (!paths || !isInsideLane(paths, prefixes)) {
    return 'the complete changed-file set is not inside the configured lane.'
  }
}

function hasLabel(pull: PullRequest, expected: string): boolean {
  return Boolean(
    pull.labels?.some((label) => label.name?.toLowerCase() === expected)
  )
}

export function isLogin(
  user: { login?: string } | undefined,
  login: string
): boolean {
  return user?.login?.toLowerCase() === login
}

export function isAuthorizedLabelEvent(
  lane: FastLaneConfig,
  labelEvent: LabelEvent | undefined
): boolean {
  return (
    labelEvent?.label === lane.approval.approvalLabel &&
    lane.approval.trustedLabelers.includes(labelEvent.actor)
  )
}

export function hasActiveHumanChangeRequest(
  reviews: PullRequestReview[]
): boolean {
  const latestState = new Map<string, string>()
  for (const review of reviews) {
    const login = review.user?.login?.toLowerCase()
    if (
      !login ||
      review.user?.type === 'Bot' ||
      login.endsWith('[bot]') ||
      !review.state ||
      !DECISIVE_REVIEW_STATES.has(review.state)
    ) {
      continue
    }
    latestState.set(login, review.state)
  }
  return [...latestState.values()].includes('CHANGES_REQUESTED')
}

function isRepository(
  repo: RepositoryRef | null | undefined,
  repository: string
): boolean {
  return repo?.full_name?.toLowerCase() === repository.toLowerCase()
}

export function isPolicyReview(
  review: PullRequestReview,
  identity: string
): boolean {
  return (
    isLogin(review.user, identity) &&
    review.body?.startsWith(POLICY_REVIEW_PREFIX) === true
  )
}

export function isPolicyApprovalForHead(
  review: PullRequestReview,
  identity: string,
  headSha: string
): boolean {
  return (
    isPolicyReview(review, identity) &&
    review.state === 'APPROVED' &&
    review.commit_id === headSha
  )
}

export function activePolicyApprovals(
  reviews: PullRequestReview[],
  identity: string
): PullRequestReview[] {
  return reviews.filter(
    (review) => isPolicyReview(review, identity) && review.state === 'APPROVED'
  )
}

export function policyReviewFloor(
  reviews: PullRequestReview[],
  identity: string
): SubmittedReview | undefined {
  return reviews
    .filter(
      (review): review is SubmittedReview =>
        isPolicyReview(review, identity) &&
        review.submitted_at !== undefined &&
        !Number.isNaN(Date.parse(review.submitted_at))
    )
    .sort(
      (left, right) =>
        Date.parse(left.submitted_at) - Date.parse(right.submitted_at)
    )[0]
}

function hasHeadPolicyApproval(
  reviews: PullRequestReview[],
  identity: string,
  headSha: string | undefined
): boolean {
  return (
    headSha !== undefined &&
    reviews.some((review) => isPolicyApprovalForHead(review, identity, headSha))
  )
}

function authorizationFailure({
  pull,
  reviews,
  lane,
  labelEvent
}: EligibilityContext): string | undefined {
  const { identity, trustedAuthors, approvalLabel } = lane.approval
  const author = pull.user?.login?.toLowerCase() ?? 'unknown'
  if (author === identity) {
    return 'the approval identity cannot approve its own pull request.'
  }
  if (trustedAuthors.includes(author)) return
  if (!hasLabel(pull, approvalLabel)) {
    return `@${author} is not trusted and ${approvalLabel} is not applied.`
  }
  if (
    isAuthorizedLabelEvent(lane, labelEvent) ||
    hasHeadPolicyApproval(reviews, identity, pull.head?.sha)
  ) {
    return
  }
  return `@${author} is not trusted and ${approvalLabel} lacks a current authorized event; re-run the cancelled labeled run or re-apply the label.`
}

export function eligibilityFailure(
  context: EligibilityContext
): string | undefined {
  const { pull, reviews, lane, repository, defaultBranch } = context
  if (pull.state !== 'open' || pull.draft) {
    return 'the pull request is not open and ready for review.'
  }
  if (
    !isRepository(pull.base?.repo, repository) ||
    pull.base?.ref !== defaultBranch
  ) {
    return `the ${lane.id} fast lane applies only to ${defaultBranch}.`
  }
  if (!isRepository(pull.head?.repo, repository)) {
    return `the ${lane.id} fast lane does not apply to fork pull requests.`
  }
  const authorization = authorizationFailure(context)
  if (authorization) return authorization
  if (hasLabel(pull, lane.approval.holdLabel)) {
    return `${lane.approval.holdLabel} is applied.`
  }
  if (hasActiveHumanChangeRequest(reviews)) {
    return 'an active human change request is present.'
  }
}
