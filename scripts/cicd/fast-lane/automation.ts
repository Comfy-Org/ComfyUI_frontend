import {
  approvalForHead,
  changedPaths,
  eligibilityFailure,
  hasActiveHumanChangeRequest,
  hasCompleteChangedFileList,
  isInsideLane,
  isSameRepository,
  targetsDefaultBranch
} from './policy.ts'
import type {
  GitHubClient,
  MergeAutomationState,
  PullRequest,
  PullRequestFile,
  PullRequestReview,
  ResolvedRuntimeConfig,
  RuntimeConfig,
  Summary
} from './types.ts'

const POLICY_REVIEW_PREFIX = '[Package fast lane] Policy-only approval.'

const MERGE_AUTOMATION_STATE = `
  query PackageFastLaneMergeState($pullRequestId: ID!) {
    node(id: $pullRequestId) {
      ... on PullRequest {
        id
        headRefOid
        mergeStateStatus
        autoMergeRequest { enabledAt enabledBy { login } }
        mergeQueueEntry {
          id
          enqueuedAt
          enqueuer { login }
          headCommit { oid }
        }
      }
    }
  }
`

function asPullRequest(value: unknown): PullRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GitHub did not return a pull request')
  }
  return value
}

function asReviews(value: unknown[]): PullRequestReview[] {
  return value as PullRequestReview[]
}

function asFiles(value: unknown[]): PullRequestFile[] {
  return value as PullRequestFile[]
}

function mergeState(value: unknown): MergeAutomationState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GitHub did not return the pull request merge state')
  }
  const data = value as { node?: MergeAutomationState }
  if (!data.node?.id) {
    throw new Error('GitHub did not return the pull request merge state')
  }
  return data.node
}

function actorMatches(
  actor: { login?: string } | undefined,
  expectedLogin: string
): boolean {
  return actor?.login?.toLowerCase() === expectedLogin.toLowerCase()
}

function atOrAfter(value: string | undefined, floor: string): boolean {
  if (!value) return false
  return Date.parse(value) >= Date.parse(floor)
}

async function readMergeState(
  github: GitHubClient,
  pullRequestId: string
): Promise<MergeAutomationState> {
  return mergeState(
    await github.graphql(MERGE_AUTOMATION_STATE, { pullRequestId })
  )
}

export async function stopMergeAutomation(
  github: GitHubClient,
  pull: PullRequest,
  identity: string,
  policyReview: PullRequestReview | undefined
): Promise<void> {
  if (!policyReview?.submitted_at) return
  if (!pull.node_id) {
    throw new Error('the pull request node id is required to stop automation')
  }

  const state = await readMergeState(github, pull.node_id)
  const errors: unknown[] = []
  const entry = state.mergeQueueEntry
  if (
    entry?.id &&
    actorMatches(entry.enqueuer, identity) &&
    atOrAfter(entry.enqueuedAt, policyReview.submitted_at)
  ) {
    try {
      await github.graphql(
        `mutation PackageFastLaneDequeue($pullRequestId: ID!) {
          dequeuePullRequest(input: { id: $pullRequestId }) { clientMutationId }
        }`,
        { pullRequestId: pull.node_id }
      )
    } catch (error) {
      errors.push(error)
    }
  }

  const autoMerge = state.autoMergeRequest
  if (
    autoMerge &&
    actorMatches(autoMerge.enabledBy, identity) &&
    atOrAfter(autoMerge.enabledAt, policyReview.submitted_at)
  ) {
    try {
      await github.graphql(
        `mutation PackageFastLaneDisableAutoMerge($pullRequestId: ID!) {
          disablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId }) {
            clientMutationId
          }
        }`,
        { pullRequestId: pull.node_id }
      )
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'failed to stop all merge automation')
  }
}

export async function armMergeAutomation(
  github: GitHubClient,
  pull: PullRequest,
  approvedHeadSha: string,
  config: RuntimeConfig,
  summary: Summary
): Promise<void> {
  if (config.lane.merge.mode === 'manual') return
  if (!pull.node_id || !pull.head?.sha) {
    throw new Error('the pull request node id and head are required to merge')
  }

  const state = await readMergeState(github, pull.node_id)
  if (
    pull.head.sha !== approvedHeadSha ||
    state.headRefOid !== approvedHeadSha
  ) {
    throw new Error('the pull request head advanced before merge automation')
  }
  if (state.mergeQueueEntry) {
    summary(`Already queued ${pull.head.sha.slice(0, 12)}.`)
    return
  }
  if (state.mergeStateStatus === 'CLEAN') {
    await github.graphql(
      `mutation PackageFastLaneEnqueue(
        $pullRequestId: ID!
        $expectedHeadOid: GitObjectID!
      ) {
        enqueuePullRequest(input: {
          pullRequestId: $pullRequestId
          expectedHeadOid: $expectedHeadOid
          jump: false
        }) { clientMutationId }
      }`,
      { pullRequestId: pull.node_id, expectedHeadOid: pull.head.sha }
    )
    summary(`Entered the native merge queue for ${pull.head.sha.slice(0, 12)}.`)
    return
  }
  if (state.autoMergeRequest) {
    summary(`Auto-merge already armed for ${pull.head.sha.slice(0, 12)}.`)
    return
  }

  await github.graphql(
    `mutation PackageFastLaneEnableAutoMerge(
      $pullRequestId: ID!
      $expectedHeadOid: GitObjectID!
      $mergeMethod: PullRequestMergeMethod!
    ) {
      enablePullRequestAutoMerge(input: {
        pullRequestId: $pullRequestId
        expectedHeadOid: $expectedHeadOid
        mergeMethod: $mergeMethod
      }) { clientMutationId }
    }`,
    {
      pullRequestId: pull.node_id,
      expectedHeadOid: pull.head.sha,
      mergeMethod: config.lane.merge.method
    }
  )
  summary(`Armed native auto-merge for ${pull.head.sha.slice(0, 12)}.`)
}

export function policyReviewFloor(
  reviews: PullRequestReview[],
  identity: string
): PullRequestReview | undefined {
  return reviews
    .filter(
      (review) =>
        review.user?.login?.toLowerCase() === identity.toLowerCase() &&
        review.body?.startsWith(POLICY_REVIEW_PREFIX) &&
        review.submitted_at !== undefined &&
        !Number.isNaN(Date.parse(review.submitted_at))
    )
    .sort(
      (left, right) =>
        Date.parse(left.submitted_at ?? '') -
        Date.parse(right.submitted_at ?? '')
    )[0]
}

async function dismissApproval(
  github: GitHubClient,
  pullRequestNumber: number,
  review: PullRequestReview | undefined,
  reason: string
): Promise<void> {
  if (!review?.id) return
  await github.request(
    `/pulls/${pullRequestNumber}/reviews/${review.id}/dismissals`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: reason })
    }
  )
}

export function activePolicyApprovals(
  reviews: PullRequestReview[],
  identity: string
): PullRequestReview[] {
  return reviews.filter(
    (review) =>
      review.state === 'APPROVED' &&
      review.user?.login?.toLowerCase() === identity.toLowerCase() &&
      review.body?.startsWith(POLICY_REVIEW_PREFIX)
  )
}

async function stop(
  github: GitHubClient,
  config: ResolvedRuntimeConfig,
  pull: PullRequest,
  reviews: PullRequestReview[],
  message: string,
  summary: Summary
): Promise<void> {
  const identity = config.lane.approval.identity
  const errors: unknown[] = []
  try {
    await stopMergeAutomation(
      github,
      pull,
      identity,
      policyReviewFloor(reviews, identity)
    )
  } catch (error) {
    errors.push(error)
  }
  for (const approval of activePolicyApprovals(reviews, identity)) {
    try {
      await dismissApproval(
        github,
        config.pullRequestNumber,
        approval,
        `Fast-lane approval withdrawn: ${message}`
      )
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      'failed to complete fast-lane compensation'
    )
  }
  summary(message)
}

async function resolvePullRequestNumber(
  github: GitHubClient,
  config: RuntimeConfig,
  summary: Summary
): Promise<number | undefined> {
  if (config.pullRequestNumber) return config.pullRequestNumber
  const response = await github.request(`/commits/${config.eventHeadSha}/pulls`)
  if (!Array.isArray(response)) {
    throw new Error('GitHub did not return pull requests for the commit')
  }
  const matches = response
    .map(asPullRequest)
    .filter(
      (pull) =>
        pull.state === 'open' &&
        pull.head?.sha === config.eventHeadSha &&
        isSameRepository(pull, config.repository) &&
        targetsDefaultBranch(pull, config.repository, config.defaultBranch)
    )
  if (matches.length !== 1 || !matches[0].number) {
    summary(
      `Skipped: expected one open same-repository pull request for ${config.eventHeadSha.slice(0, 12)}, found ${matches.length}.`
    )
    return
  }
  return matches[0].number
}

async function readPullState(
  github: GitHubClient,
  pullRequestNumber: number
): Promise<{
  pull: PullRequest
  reviews: PullRequestReview[]
}> {
  const [pull, reviews] = await Promise.all([
    github.request(`/pulls/${pullRequestNumber}`),
    github.paginate(`/pulls/${pullRequestNumber}/reviews`)
  ])
  return {
    pull: asPullRequest(pull),
    reviews: asReviews(reviews)
  }
}

async function revalidate(
  github: GitHubClient,
  config: ResolvedRuntimeConfig,
  summary: Summary
): Promise<{ pull: PullRequest; reviews: PullRequestReview[] } | undefined> {
  const state = await readPullState(github, config.pullRequestNumber)
  const failure = eligibilityFailure({
    pull: state.pull,
    lane: config.lane,
    repository: config.repository,
    defaultBranch: config.defaultBranch,
    expectedHeadSha: config.eventHeadSha,
    hasPolicyApprovalForHead: Boolean(
      approvalForHead(
        state.reviews,
        config.lane.approval.identity,
        config.eventHeadSha,
        POLICY_REVIEW_PREFIX
      )
    ),
    eventName: config.eventName,
    eventAction: config.eventAction,
    eventActor: config.eventActor,
    eventLabel: config.eventLabel
  })
  const reason =
    failure ??
    (hasActiveHumanChangeRequest(state.reviews)
      ? 'Skipped: an active human change request is present.'
      : undefined)
  if (!reason) return state

  await stop(github, config, state.pull, state.reviews, reason, summary)
}

export async function approveCurrentHead(
  github: GitHubClient,
  config: ResolvedRuntimeConfig,
  reviews: PullRequestReview[],
  summary: Summary
): Promise<boolean> {
  const identity = config.lane.approval.identity
  const headSha = config.eventHeadSha
  if (approvalForHead(reviews, identity, headSha, POLICY_REVIEW_PREFIX)) {
    summary(`Already approved ${headSha.slice(0, 12)} as @${identity}.`)
    return true
  }

  const created = asReviews([
    await github.request(`/pulls/${config.pullRequestNumber}/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'APPROVE',
        commit_id: headSha,
        body: `${POLICY_REVIEW_PREFIX} Lane: ${config.lane.id}. No diff review was performed; eligibility was bound to the trusted policy, exact head, and configured path boundary.`
      })
    })
  ])[0]

  let verified
  try {
    verified = await revalidate(github, config, summary)
  } catch (error) {
    await dismissApproval(
      github,
      config.pullRequestNumber,
      created,
      'Fast-lane approval withdrawn: post-approval verification failed.'
    )
    throw error
  }
  if (!verified) return false
  summary(`Approved ${headSha.slice(0, 12)} as @${identity}.`)
  return true
}

async function assertIdentity(
  github: GitHubClient,
  expectedIdentity: string
): Promise<void> {
  const response = await github.request('https://api.github.com/user')
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('GitHub did not return the approval identity')
  }
  const login = (response as { login?: string }).login
  if (login?.toLowerCase() !== expectedIdentity) {
    throw new Error(
      `FAST_LANE_TOKEN belongs to ${login ?? 'an unknown account'}, expected ${expectedIdentity}`
    )
  }
}

async function resolveRuntimeConfig(
  github: GitHubClient,
  config: RuntimeConfig,
  summary: Summary
): Promise<ResolvedRuntimeConfig | undefined> {
  const pullRequestNumber = await resolvePullRequestNumber(
    github,
    config,
    summary
  )
  if (!pullRequestNumber) return
  return { ...config, pullRequestNumber }
}

async function readInitialEligibleState(
  github: GitHubClient,
  config: ResolvedRuntimeConfig,
  summary: Summary
): Promise<{ pull: PullRequest; reviews: PullRequestReview[] } | undefined> {
  const state = await revalidate(github, config, summary)
  if (!state) return
  if (state.pull.user?.login?.toLowerCase() === config.lane.approval.identity) {
    throw new Error('the approval identity cannot approve its own pull request')
  }
  return state
}

function filesStayInsideLane(
  files: PullRequestFile[],
  pull: PullRequest,
  config: ResolvedRuntimeConfig
): boolean {
  if (!hasCompleteChangedFileList(files, pull.changed_files)) return false
  const paths = changedPaths(files)
  if (!paths) return false
  return isInsideLane(paths, config.lane.pathPrefixes)
}

async function verifyLanePaths(
  github: GitHubClient,
  config: ResolvedRuntimeConfig,
  state: { pull: PullRequest; reviews: PullRequestReview[] },
  summary: Summary
): Promise<boolean> {
  const files = asFiles(
    await github.paginate(`/pulls/${config.pullRequestNumber}/files`)
  )
  if (filesStayInsideLane(files, state.pull, config)) return true
  await stop(
    github,
    config,
    state.pull,
    state.reviews,
    'Skipped: the complete changed-file set is not inside the configured lane.',
    summary
  )
  return false
}

async function approveAndArm(
  github: GitHubClient,
  config: ResolvedRuntimeConfig,
  summary: Summary
): Promise<void> {
  const state = await revalidate(github, config, summary)
  if (!state) return
  const approved = await approveCurrentHead(
    github,
    config,
    state.reviews,
    summary
  )
  if (!approved) return
  const verified = await revalidate(github, config, summary)
  if (!verified) return
  try {
    await armMergeAutomation(
      github,
      verified.pull,
      config.eventHeadSha,
      config,
      summary
    )
    await revalidate(github, config, summary)
  } catch (error) {
    const state = await readPullState(github, config.pullRequestNumber)
    try {
      await stop(
        github,
        config,
        state.pull,
        state.reviews,
        'Merge automation failed; approval and merge state were withdrawn.',
        summary
      )
    } catch (cleanupError) {
      throw new Error(
        `Merge automation failed (${String(error)}) and compensation also failed.`,
        { cause: cleanupError }
      )
    }
    throw error
  }
}

export async function runFastLane(
  github: GitHubClient,
  config: RuntimeConfig,
  summary: Summary
): Promise<void> {
  await assertIdentity(github, config.lane.approval.identity)
  const resolved = await resolveRuntimeConfig(github, config, summary)
  if (!resolved) return
  const initial = await readInitialEligibleState(github, resolved, summary)
  if (
    !initial ||
    !(await verifyLanePaths(github, resolved, initial, summary))
  ) {
    return
  }
  await approveAndArm(github, resolved, summary)
}
