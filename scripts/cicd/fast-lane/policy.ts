import type {
  FastLaneConfig,
  PullRequest,
  PullRequestFile,
  PullRequestReview
} from './types.ts'

const DECISIVE_REVIEW_STATES = new Set([
  'APPROVED',
  'CHANGES_REQUESTED',
  'DISMISSED'
])

export interface EligibilityContext {
  pull: PullRequest
  lane: FastLaneConfig
  repository: string
  defaultBranch: string
  expectedHeadSha: string
  hasPolicyApprovalForHead: boolean
  eventName: string
  eventAction?: string
  eventActor?: string
  eventLabel?: string
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

function hasLabel(pull: PullRequest, expected: string): boolean {
  return Boolean(
    pull.labels?.some((label) => label.name?.toLowerCase() === expected)
  )
}

export function hasAuthorizedApprovalLabel(
  pull: PullRequest,
  lane: FastLaneConfig,
  event: {
    name: string
    action?: string
    actor?: string
    label?: string
  }
): boolean {
  const { approvalLabel, trustedLabelers } = lane.approval
  if (!hasLabel(pull, approvalLabel)) return false
  return (
    event.name === 'pull_request_target' &&
    event.action === 'labeled' &&
    event.label?.toLowerCase() === approvalLabel &&
    event.actor !== undefined &&
    trustedLabelers.includes(event.actor.toLowerCase())
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

export function isSameRepository(
  pull: PullRequest,
  repository: string
): boolean {
  return pull.head?.repo?.full_name?.toLowerCase() === repository.toLowerCase()
}

export function targetsDefaultBranch(
  pull: PullRequest,
  repository: string,
  defaultBranch: string
): boolean {
  return (
    pull.base?.repo?.full_name?.toLowerCase() === repository.toLowerCase() &&
    pull.base.ref === defaultBranch
  )
}

export function eligibilityFailure({
  pull,
  lane,
  repository,
  defaultBranch,
  expectedHeadSha,
  hasPolicyApprovalForHead,
  eventName,
  eventAction,
  eventActor,
  eventLabel
}: EligibilityContext): string | undefined {
  if (pull.state !== 'open' || pull.draft) {
    return 'Skipped: the pull request is not open and ready for review.'
  }
  if (!targetsDefaultBranch(pull, repository, defaultBranch)) {
    return `Skipped: the ${lane.id} fast lane applies only to ${defaultBranch}.`
  }
  if (!isSameRepository(pull, repository)) {
    return `Skipped: the ${lane.id} fast lane does not apply to fork pull requests.`
  }
  if (pull.head?.sha !== expectedHeadSha) {
    return 'Skipped: the pull request head advanced after this workflow started.'
  }

  const author = pull.user?.login?.toLowerCase()
  const trustedAuthor = author && lane.approval.trustedAuthors.includes(author)
  const currentLabelEvent = hasAuthorizedApprovalLabel(pull, lane, {
    name: eventName,
    action: eventAction,
    actor: eventActor,
    label: eventLabel
  })
  if (!trustedAuthor && !hasPolicyApprovalForHead && !currentLabelEvent) {
    return `Skipped: @${author ?? 'unknown'} is not trusted and ${lane.approval.approvalLabel} lacks a current authorized event.`
  }
  if (hasLabel(pull, lane.approval.holdLabel)) {
    return `Skipped: ${lane.approval.holdLabel} is applied.`
  }
}

export function isApprovalForHead(
  review: PullRequestReview,
  identity: string,
  headSha: string
): boolean {
  return (
    review.state === 'APPROVED' &&
    review.commit_id === headSha &&
    review.user?.login?.toLowerCase() === identity.toLowerCase()
  )
}

export function approvalForHead(
  reviews: PullRequestReview[],
  identity: string,
  headSha: string,
  bodyPrefix: string
): PullRequestReview | undefined {
  return reviews.findLast(
    (review) =>
      isApprovalForHead(review, identity, headSha) &&
      review.body?.startsWith(bodyPrefix)
  )
}
