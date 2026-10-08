import { isRecord } from './github.ts'
import {
  activePolicyApprovals,
  eligibilityFailure,
  isLogin,
  isPolicyApprovalForHead,
  pathFailure,
  policyReviewFloor,
  POLICY_REVIEW_PREFIX
} from './policy.ts'
import type {
  GitHubClient,
  MergeAutomationState,
  PullRequest,
  PullRequestFile,
  PullRequestReview,
  RuntimeConfig,
  SubmittedReview,
  Summary
} from './types.ts'

interface PullState {
  pull: PullRequest
  reviews: PullRequestReview[]
}

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

function shortSha(sha: string): string {
  return sha.slice(0, 12)
}

function asPullRequest(value: unknown): PullRequest {
  if (!isRecord(value)) throw new Error('GitHub did not return a pull request')
  return value
}

function mergeState(value: unknown): MergeAutomationState {
  const node = isRecord(value)
    ? (value as { node?: MergeAutomationState }).node
    : undefined
  if (!node?.id) {
    throw new Error('GitHub did not return the pull request merge state')
  }
  return node
}

function atOrAfter(value: string | undefined, floor: string): boolean {
  if (!value) return false
  return Date.parse(value) >= Date.parse(floor)
}

async function readMergeState(
  github: GitHubClient,
  pull: PullRequest
): Promise<MergeAutomationState> {
  if (!pull.node_id) throw new Error('the pull request node id is required')
  return mergeState(
    await github.graphql(MERGE_AUTOMATION_STATE, {
      pullRequestId: pull.node_id
    })
  )
}

async function attemptAll(
  tasks: (() => Promise<unknown>)[],
  message: string
): Promise<void> {
  const errors: unknown[] = []
  for (const task of tasks) {
    try {
      await task()
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, message)
}

export async function stopMergeAutomation(
  github: GitHubClient,
  pull: PullRequest,
  identity: string,
  floor: SubmittedReview | undefined
): Promise<void> {
  if (!floor) return
  const { id, mergeQueueEntry, autoMergeRequest } = await readMergeState(
    github,
    pull
  )
  const ownedSinceFloor = (
    actor: { login?: string } | undefined,
    at: string | undefined
  ) => isLogin(actor, identity) && atOrAfter(at, floor.submitted_at)

  const dequeue = () =>
    github.graphql(
      `mutation PackageFastLaneDequeue($pullRequestId: ID!) {
        dequeuePullRequest(input: { id: $pullRequestId }) { clientMutationId }
      }`,
      { pullRequestId: id }
    )
  const disableAutoMerge = () =>
    github.graphql(
      `mutation PackageFastLaneDisableAutoMerge($pullRequestId: ID!) {
        disablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId }) {
          clientMutationId
        }
      }`,
      { pullRequestId: id }
    )

  await attemptAll(
    [
      ...(mergeQueueEntry?.id &&
      ownedSinceFloor(mergeQueueEntry.enqueuer, mergeQueueEntry.enqueuedAt)
        ? [dequeue]
        : []),
      ...(autoMergeRequest &&
      ownedSinceFloor(autoMergeRequest.enabledBy, autoMergeRequest.enabledAt)
        ? [disableAutoMerge]
        : [])
    ],
    'failed to stop all merge automation'
  )
}

async function armMergeAutomation(
  github: GitHubClient,
  pull: PullRequest,
  config: RuntimeConfig,
  summary: Summary
): Promise<void> {
  if (config.lane.merge.mode === 'manual') return

  const headSha = config.eventHeadSha
  const state = await readMergeState(github, pull)
  if (state.headRefOid !== headSha) {
    summary('Skipped: the pull request head advanced before merge automation.')
    return
  }
  if (state.mergeQueueEntry) {
    summary(`Already queued ${shortSha(headSha)}.`)
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
      { pullRequestId: state.id, expectedHeadOid: headSha }
    )
    summary(`Entered the native merge queue for ${shortSha(headSha)}.`)
    return
  }
  if (state.autoMergeRequest) {
    summary(`Auto-merge already armed for ${shortSha(headSha)}.`)
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
      pullRequestId: state.id,
      expectedHeadOid: headSha,
      mergeMethod: config.lane.merge.method
    }
  )
  summary(`Armed native auto-merge for ${shortSha(headSha)}.`)
}

async function dismissApproval(
  github: GitHubClient,
  pullRequestNumber: number,
  review: PullRequestReview,
  reason: string
): Promise<void> {
  if (!review.id) return
  await github.request(
    `/pulls/${pullRequestNumber}/reviews/${review.id}/dismissals`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: `Fast-lane approval withdrawn: ${reason}`
      })
    }
  )
}

async function withdraw(
  github: GitHubClient,
  config: RuntimeConfig,
  { pull, reviews }: PullState,
  reason: string,
  summary: Summary
): Promise<void> {
  const identity = config.lane.approval.identity
  await attemptAll(
    [
      () =>
        stopMergeAutomation(
          github,
          pull,
          identity,
          policyReviewFloor(reviews, identity)
        ),
      ...activePolicyApprovals(reviews, identity).map(
        (approval) => () =>
          dismissApproval(github, config.pullRequestNumber, approval, reason)
      )
    ],
    'failed to complete fast-lane compensation'
  )
  summary(`Skipped: ${reason}`)
}

async function readPullState(
  github: GitHubClient,
  pullRequestNumber: number
): Promise<PullState> {
  const [pull, reviews] = await Promise.all([
    github.request(`/pulls/${pullRequestNumber}`),
    github.paginate(`/pulls/${pullRequestNumber}/reviews`)
  ])
  return {
    pull: asPullRequest(pull),
    reviews: reviews as PullRequestReview[]
  }
}

async function revalidateOrWithdraw(
  github: GitHubClient,
  config: RuntimeConfig,
  summary: Summary
): Promise<PullState | undefined> {
  const state = await readPullState(github, config.pullRequestNumber)
  if (state.pull.head?.sha !== config.eventHeadSha) {
    summary('Skipped: the pull request head advanced after this run started.')
    return
  }
  const reason = eligibilityFailure({
    pull: state.pull,
    reviews: state.reviews,
    lane: config.lane,
    repository: config.repository,
    defaultBranch: config.defaultBranch,
    labelEvent: config.labelEvent
  })
  if (!reason) return state
  await withdraw(github, config, state, reason, summary)
}

async function assertIdentity(
  github: GitHubClient,
  expectedIdentity: string
): Promise<void> {
  const response = await github.request('https://api.github.com/user')
  const login =
    isRecord(response) && typeof response.login === 'string'
      ? response.login
      : undefined
  if (!isLogin({ login }, expectedIdentity)) {
    throw new Error(
      `FAST_LANE_TOKEN belongs to ${login ?? 'an unknown account'}, expected ${expectedIdentity}`
    )
  }
}

async function postPolicyApproval(
  github: GitHubClient,
  config: RuntimeConfig
): Promise<void> {
  await github.request(`/pulls/${config.pullRequestNumber}/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'APPROVE',
      commit_id: config.eventHeadSha,
      body: `${POLICY_REVIEW_PREFIX} Lane: ${config.lane.id}. No diff review was performed; eligibility was bound to the trusted policy, exact head, and configured path boundary.`
    })
  })
}

async function withdrawAfterFailure(
  github: GitHubClient,
  config: RuntimeConfig,
  error: unknown,
  summary: Summary
): Promise<never> {
  try {
    const current = await readPullState(github, config.pullRequestNumber)
    await withdraw(
      github,
      config,
      current,
      'the run failed after approval; approval and merge state were withdrawn.',
      summary
    )
  } catch (cleanupError) {
    throw new Error(
      `Fast-lane run failed (${String(error)}) and compensation also failed.`,
      { cause: cleanupError }
    )
  }
  throw error
}

export async function runFastLane(
  github: GitHubClient,
  config: RuntimeConfig,
  summary: Summary
): Promise<void> {
  const { identity } = config.lane.approval
  const headSha = config.eventHeadSha
  await assertIdentity(github, identity)
  const initial = await revalidateOrWithdraw(github, config, summary)
  if (!initial) return

  const files = (await github.paginate(
    `/pulls/${config.pullRequestNumber}/files`
  )) as PullRequestFile[]
  const outsideLane = pathFailure(files, initial.pull, config.lane.pathPrefixes)
  if (outsideLane) {
    await withdraw(github, config, initial, outsideLane, summary)
    return
  }

  const alreadyApproved = initial.reviews.some((review) =>
    isPolicyApprovalForHead(review, identity, headSha)
  )
  if (!alreadyApproved) await postPolicyApproval(github, config)

  try {
    const verified = await revalidateOrWithdraw(github, config, summary)
    if (!verified) return
    summary(
      `${alreadyApproved ? 'Already approved' : 'Approved'} ${shortSha(headSha)} as @${identity}.`
    )
    await armMergeAutomation(github, verified.pull, config, summary)
    await revalidateOrWithdraw(github, config, summary)
  } catch (error) {
    await withdrawAfterFailure(github, config, error, summary)
  }
}
