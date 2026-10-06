import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API_VERSION = '2022-11-28'
const PAGE_SIZE = 100
const HOLD_LABEL = 'website-fast-lane:hold'
const APPROVE_LABEL = 'website-fast-lane:approve'
const GRAPHQL_URL = 'https://api.github.com/graphql'
const POLICY_REVIEW_PREFIX =
  '[Validation canary] Policy-only automatic approval.'
const DECISIVE_REVIEW_STATES = new Set([
  'APPROVED',
  'CHANGES_REQUESTED',
  'DISMISSED'
])

export function parseApprovedAuthors(raw) {
  let authors
  try {
    authors = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `WEBSITE_AUTO_APPROVE_AUTHORS must be JSON: ${error.message}`,
      { cause: error }
    )
  }

  if (
    !Array.isArray(authors) ||
    authors.some((author) => typeof author !== 'string')
  ) {
    throw new Error(
      'WEBSITE_AUTO_APPROVE_AUTHORS must be a JSON array of GitHub logins'
    )
  }

  return new Set(
    authors.map((author) => author.trim().toLowerCase()).filter(Boolean)
  )
}

export function isWebsiteOnly(paths) {
  return (
    paths.length > 0 &&
    paths.every((changedPath) => changedPath.startsWith('apps/website/'))
  )
}

export function hasCompleteChangedFileList(files, changedFileCount) {
  return (
    Number.isSafeInteger(changedFileCount) && files.length === changedFileCount
  )
}

export function changedPaths(files) {
  const pathGroups = files.map(changedPathGroup)
  if (pathGroups.includes(null)) return null
  return pathGroups.flat()
}

function changedPathGroup(file) {
  if (typeof file?.filename !== 'string') return null
  if (file.previous_filename === undefined) {
    if (file.status === 'renamed' || file.status === 'copied') return null
    return [file.filename]
  }
  if (typeof file.previous_filename !== 'string') return null
  return [file.filename, file.previous_filename]
}

export function hasHoldLabel(pull) {
  return pull?.labels?.some(
    (label) => label?.name?.toLowerCase() === HOLD_LABEL
  )
}

function hasLabel(pull, expectedLabel) {
  return pull?.labels?.some(
    (label) => label?.name?.toLowerCase() === expectedLabel
  )
}

export function hasAuthorizedApprovalLabel(pull, events, approvedLabelers) {
  if (!hasLabel(pull, APPROVE_LABEL)) return false

  let latestCodeEvent = -1
  let latestApprovalLabelEvent = -1
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (
      latestCodeEvent === -1 &&
      (event?.event === 'committed' || event?.event === 'head_ref_force_pushed')
    ) {
      latestCodeEvent = index
    }
    if (
      latestApprovalLabelEvent === -1 &&
      event?.label?.name?.toLowerCase() === APPROVE_LABEL
    ) {
      latestApprovalLabelEvent = index
    }
  }

  if (latestCodeEvent === -1 || latestApprovalLabelEvent <= latestCodeEvent) {
    return false
  }
  const labelEvent = events[latestApprovalLabelEvent]
  const actor = labelEvent?.actor?.login?.toLowerCase()
  return labelEvent.event === 'labeled' && approvedLabelers.has(actor)
}

export function hasActiveChangeRequest(reviews) {
  const latestStateByReviewer = new Map()
  for (const review of reviews) {
    const login = review?.user?.login?.toLowerCase()
    if (!login || review.user?.type === 'Bot' || login.endsWith('[bot]')) {
      continue
    }
    if (!DECISIVE_REVIEW_STATES.has(review.state)) continue
    latestStateByReviewer.set(login, review.state)
  }
  return [...latestStateByReviewer.values()].includes('CHANGES_REQUESTED')
}

export function isSameRepository(pull, repository) {
  return pull?.head?.repo?.full_name?.toLowerCase() === repository.toLowerCase()
}

export function targetsDefaultBranch(pull, repository, defaultBranch) {
  return (
    pull?.base?.repo?.full_name?.toLowerCase() === repository.toLowerCase() &&
    pull?.base?.ref === defaultBranch
  )
}

export function alreadyApprovedCurrentHead(reviews, approverLogin, headSha) {
  const expectedLogin = approverLogin.toLowerCase()
  return reviews.some((review) =>
    isApprovalForHead(review, expectedLogin, headSha)
  )
}

function isApprovalForHead(review, expectedLogin, headSha) {
  if (review?.state !== 'APPROVED') return false
  if (review.commit_id !== headSha) return false
  return review.user?.login?.toLowerCase() === expectedLogin
}

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function optionalPositiveIntegerEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) return
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${name} must be positive`)
  }
  return number
}

function githubClient(token, repository) {
  const root = `https://api.github.com/repos/${repository}`
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': API_VERSION,
    'user-agent': 'comfy-website-auto-approve/1.0'
  }

  async function request(requestPath, options = {}) {
    const response = await fetch(apiUrl(root, requestPath), {
      ...options,
      headers: { ...headers, ...options.headers }
    })
    return responseBody(response, options.method, requestPath)
  }

  async function paginate(requestPath) {
    const rows = []
    for (let page = 1; ; page += 1) {
      const body = await request(pagePath(requestPath, page))
      assertArrayResponse(body, requestPath)
      rows.push(...body)
      if (body.length < PAGE_SIZE) return rows
    }
  }

  async function graphql(query, variables) {
    const body = await request(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables })
    })
    if (body?.errors?.length) {
      throw new Error(
        `GitHub GraphQL failed: ${body.errors
          .map((error) => error.message)
          .join('; ')}`
      )
    }
    return body?.data
  }

  return { graphql, paginate, request }
}

function apiUrl(root, requestPath) {
  if (requestPath.startsWith('https://')) return requestPath
  return `${root}${requestPath}`
}

async function responseBody(response, method, requestPath) {
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500)
    throw new Error(
      `GitHub API ${method ?? 'GET'} ${requestPath} failed: ${response.status} ${body}`
    )
  }
  if (response.status === 204) return null
  return response.json()
}

function pagePath(requestPath, page) {
  const separator = requestPath.includes('?') ? '&' : '?'
  return `${requestPath}${separator}per_page=${PAGE_SIZE}&page=${page}`
}

function assertArrayResponse(body, requestPath) {
  if (!Array.isArray(body)) {
    throw new Error(`GitHub API ${requestPath} did not return an array`)
  }
}

function summary(message) {
  process.stdout.write(`${message}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`)
  }
}

function configuration() {
  const config = {
    token: requiredEnv('WEBSITE_APPROVAL_TOKEN'),
    repository: requiredEnv('GITHUB_REPOSITORY'),
    prNumber: optionalPositiveIntegerEnv('PR_NUMBER'),
    eventHeadSha: requiredEnv('PR_HEAD_SHA'),
    defaultBranch: requiredEnv('WEBSITE_APPROVAL_BASE_REF'),
    expectedApprover: requiredEnv('WEBSITE_APPROVER_LOGIN'),
    approvedAuthors: parseApprovedAuthors(
      requiredEnv('WEBSITE_AUTO_APPROVE_AUTHORS')
    ),
    approvedLabelers: parseApprovedAuthors(
      requiredEnv('WEBSITE_AUTO_APPROVE_LABELERS')
    )
  }
  return config
}

async function resolvePullNumber(github, config) {
  if (config.prNumber) return config.prNumber
  const pulls = await github.request(`/commits/${config.eventHeadSha}/pulls`)
  if (!Array.isArray(pulls)) {
    throw new Error('GitHub did not return pull requests for the commit')
  }
  const matches = pulls.filter((pull) => {
    return (
      pull?.state === 'open' &&
      pull?.head?.sha === config.eventHeadSha &&
      isSameRepository(pull, config.repository) &&
      targetsDefaultBranch(pull, config.repository, config.defaultBranch)
    )
  })
  if (matches.length !== 1) {
    summary(
      `Skipped: expected one open same-repository pull request for ${config.eventHeadSha.slice(0, 12)}, found ${matches.length}.`
    )
    return
  }
  config.prNumber = matches[0].number
  return config.prNumber
}

function readinessFailure({ pull }) {
  if (pull?.state !== 'open') {
    return 'Skipped: the pull request is not open and ready for review.'
  }
  if (pull.draft) {
    return 'Skipped: the pull request is not open and ready for review.'
  }
}

function baseFailure({ pull, config }) {
  if (targetsDefaultBranch(pull, config.repository, config.defaultBranch))
    return
  return `Skipped: website fast-lane approvals apply only to ${config.defaultBranch}.`
}

function repositoryFailure({ pull, config }) {
  if (isSameRepository(pull, config.repository)) return
  return 'Skipped: website fast-lane approvals do not apply to fork pull requests.'
}

function headFailure({ pull, config }) {
  if (pull?.head?.sha === config.eventHeadSha) return
  return 'Skipped: the pull request head advanced after this workflow started.'
}

function authorizationFailure({ pull, config, events }) {
  const author = pull?.user?.login?.toLowerCase()
  if (author && config.approvedAuthors.has(author)) return
  if (hasAuthorizedApprovalLabel(pull, events, config.approvedLabelers)) return
  return `Skipped: @${author ?? 'unknown'} is not allowlisted and ${APPROVE_LABEL} was not applied by an authorized operator.`
}

function holdFailure({ pull }) {
  if (!hasHoldLabel(pull)) return
  return `Skipped: ${HOLD_LABEL} is applied.`
}

const ELIGIBILITY_CHECKS = [
  readinessFailure,
  baseFailure,
  repositoryFailure,
  headFailure,
  authorizationFailure,
  holdFailure
]

function eligibilityFailure(context) {
  return ELIGIBILITY_CHECKS.map((check) => check(context)).find(Boolean)
}

async function assertApproverIdentity(github, expectedApprover) {
  const actor = await github.request('https://api.github.com/user')
  if (actor?.login?.toLowerCase() !== expectedApprover.toLowerCase()) {
    throw new Error(
      `WEBSITE_APPROVAL_TOKEN belongs to ${actor?.login ?? 'an unknown account'}, expected ${expectedApprover}`
    )
  }
}

function assertNotSelfApproval(pull, expectedApprover) {
  if (pull.user.login.toLowerCase() === expectedApprover.toLowerCase()) {
    throw new Error('the approval bot cannot approve its own pull request')
  }
}

function approvalForHead(reviews, approverLogin, headSha) {
  const expectedLogin = approverLogin.toLowerCase()
  for (let index = reviews.length - 1; index >= 0; index -= 1) {
    const review = reviews[index]
    if (isApprovalForHead(review, expectedLogin, headSha)) return review
  }
}

function latestPolicyReview(reviews, approverLogin) {
  const expectedLogin = approverLogin.toLowerCase()
  return [...reviews].reverse().find((review) => {
    return (
      review?.user?.login?.toLowerCase() === expectedLogin &&
      review?.body?.startsWith(POLICY_REVIEW_PREFIX) &&
      !Number.isNaN(Date.parse(review.submitted_at))
    )
  })
}

async function dismissApproval(github, prNumber, review, reason) {
  if (!review?.id) return false
  await github.request(`/pulls/${prNumber}/reviews/${review.id}/dismissals`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: reason })
  })
  return true
}

const MERGE_AUTOMATION_STATE = `
  query WebsiteFastLaneMergeState($pullRequestId: ID!) {
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

function actorMatches(actor, expectedLogin) {
  return actor?.login?.toLowerCase() === expectedLogin.toLowerCase()
}

async function mergeAutomationState(github, pullRequestId) {
  const data = await github.graphql(MERGE_AUTOMATION_STATE, { pullRequestId })
  if (!data?.node?.id) {
    throw new Error('GitHub did not return the pull request merge state')
  }
  return data.node
}

function atOrAfter(value, floor) {
  return Date.parse(value) >= Date.parse(floor)
}

export async function stopMergeAutomation(github, config, pull, policyReview) {
  // Christian may also use native auto-merge manually. Only touch merge state
  // created after this workflow's identifiable policy review.
  if (!policyReview) return
  if (!pull?.node_id) {
    throw new Error(
      'the pull request node id is required to stop merge automation'
    )
  }
  const state = await mergeAutomationState(github, pull.node_id)
  const entry = state.mergeQueueEntry
  if (
    entry &&
    actorMatches(entry.enqueuer, config.expectedApprover) &&
    atOrAfter(entry.enqueuedAt, policyReview.submitted_at)
  ) {
    await github.graphql(
      `mutation WebsiteFastLaneDequeue($id: ID!) {
        dequeuePullRequest(input: { id: $id }) { clientMutationId }
      }`,
      { id: entry.id }
    )
  }
  if (
    state.autoMergeRequest &&
    actorMatches(state.autoMergeRequest.enabledBy, config.expectedApprover) &&
    atOrAfter(state.autoMergeRequest.enabledAt, policyReview.submitted_at)
  ) {
    await github.graphql(
      `mutation WebsiteFastLaneDisableAutoMerge($pullRequestId: ID!) {
        disablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId }) {
          clientMutationId
        }
      }`,
      { pullRequestId: pull.node_id }
    )
  }
}

export async function armMergeAutomation(github, pull) {
  if (!pull?.node_id) {
    throw new Error(
      'the pull request node id is required to arm merge automation'
    )
  }
  const state = await mergeAutomationState(github, pull.node_id)
  if (state.headRefOid !== pull.head.sha) {
    throw new Error('the pull request head advanced before merge automation')
  }
  if (state.mergeQueueEntry) {
    summary(`Already queued ${pull.head.sha.slice(0, 12)}.`)
    return
  }
  if (state.mergeStateStatus === 'CLEAN') {
    await github.graphql(
      `mutation WebsiteFastLaneEnqueue(
        $pullRequestId: ID!
        $expectedHeadOid: GitObjectID!
      ) {
        enqueuePullRequest(input: {
          pullRequestId: $pullRequestId
          expectedHeadOid: $expectedHeadOid
          jump: false
        }) { clientMutationId }
      }`,
      {
        pullRequestId: pull.node_id,
        expectedHeadOid: pull.head.sha
      }
    )
    summary(`Entered the native merge queue for ${pull.head.sha.slice(0, 12)}.`)
    return
  }
  if (state.autoMergeRequest) {
    summary(`Auto-merge already armed for ${pull.head.sha.slice(0, 12)}.`)
    return
  }
  await github.graphql(
    `mutation WebsiteFastLaneEnableAutoMerge(
      $pullRequestId: ID!
      $expectedHeadOid: GitObjectID!
    ) {
      enablePullRequestAutoMerge(input: {
        pullRequestId: $pullRequestId
        expectedHeadOid: $expectedHeadOid
        mergeMethod: SQUASH
      }) { clientMutationId }
    }`,
    {
      pullRequestId: pull.node_id,
      expectedHeadOid: pull.head.sha
    }
  )
  summary(`Armed native auto-merge for ${pull.head.sha.slice(0, 12)}.`)
}

async function stopWithSummary({ github, config, pull, reviews, message }) {
  const approval = approvalForHead(
    reviews,
    config.expectedApprover,
    pull?.head?.sha
  )
  if (approval) {
    await dismissApproval(
      github,
      config.prNumber,
      approval,
      `Website fast-lane approval withdrawn: ${message}`
    )
  }
  await stopMergeAutomation(
    github,
    config,
    pull,
    latestPolicyReview(reviews, config.expectedApprover)
  )
  summary(message)
}

async function validateWebsitePaths(github, config, pull, reviews) {
  const files = await github.paginate(`/pulls/${config.prNumber}/files`)
  if (!hasCompleteChangedFileList(files, pull.changed_files)) {
    await stopWithSummary({
      github,
      config,
      pull,
      reviews,
      message: 'Skipped: could not enumerate every changed file.'
    })
    return false
  }
  const paths = changedPaths(files)
  if (paths === null || !isWebsiteOnly(paths)) {
    await stopWithSummary({
      github,
      config,
      pull,
      reviews,
      message: 'Skipped: at least one changed file is outside apps/website/**.'
    })
    return false
  }
  return true
}

async function revalidatePull(github, config) {
  const recheckedPull = await github.request(`/pulls/${config.prNumber}`)
  const recheckedReviews = await github.paginate(
    `/pulls/${config.prNumber}/reviews`
  )
  const recheckedEvents = await github.paginate(
    `/issues/${config.prNumber}/timeline`
  )
  const recheckedFailure = eligibilityFailure({
    pull: recheckedPull,
    config,
    events: recheckedEvents
  })
  if (recheckedFailure) {
    await stopWithSummary({
      github,
      config,
      pull: recheckedPull,
      reviews: recheckedReviews,
      message: recheckedFailure
    })
    return
  }
  if (hasActiveChangeRequest(recheckedReviews)) {
    await stopWithSummary({
      github,
      config,
      pull: recheckedPull,
      reviews: recheckedReviews,
      message: 'Skipped: an active reviewer change request is present.'
    })
    return
  }
  return recheckedReviews
}

export async function approveCurrentHead(github, config, liveHeadSha, reviews) {
  if (
    alreadyApprovedCurrentHead(reviews, config.expectedApprover, liveHeadSha)
  ) {
    summary(
      `Already approved ${liveHeadSha.slice(0, 12)} as @${config.expectedApprover}.`
    )
    return true
  }

  const createdReview = await github.request(
    `/pulls/${config.prNumber}/reviews`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'APPROVE',
        commit_id: liveHeadSha,
        body: `${POLICY_REVIEW_PREFIX} No diff review was performed; eligibility was bound to a trusted author or authorized approval-label event, the exact head commit, and the \`apps/website/**\` path boundary.`
      })
    }
  )

  let verifiedPull
  let verifiedReviews
  let verifiedEvents
  try {
    verifiedPull = await github.request(`/pulls/${config.prNumber}`)
    verifiedReviews = await github.paginate(`/pulls/${config.prNumber}/reviews`)
    verifiedEvents = await github.paginate(
      `/issues/${config.prNumber}/timeline`
    )
  } catch (error) {
    await dismissApproval(
      github,
      config.prNumber,
      createdReview,
      'Website fast-lane approval withdrawn: post-approval verification failed.'
    )
    throw error
  }
  const verificationFailure = eligibilityFailure({
    pull: verifiedPull,
    config,
    events: verifiedEvents
  })
  if (verificationFailure || hasActiveChangeRequest(verifiedReviews)) {
    const reason =
      verificationFailure ??
      'Skipped: an active reviewer change request appeared during approval.'
    await dismissApproval(
      github,
      config.prNumber,
      createdReview,
      `Website fast-lane approval withdrawn: ${reason}`
    )
    summary(`Approval withdrawn: ${reason}`)
    return false
  }
  summary(
    `Approved ${liveHeadSha.slice(0, 12)} as @${config.expectedApprover}.`
  )
  return true
}

async function main() {
  const config = configuration()
  const github = githubClient(config.token, config.repository)
  await assertApproverIdentity(github, config.expectedApprover)
  if (!(await resolvePullNumber(github, config))) return

  const pull = await github.request(`/pulls/${config.prNumber}`)
  const reviews = await github.paginate(`/pulls/${config.prNumber}/reviews`)
  const events = await github.paginate(`/issues/${config.prNumber}/timeline`)
  const failure = eligibilityFailure({ pull, config, events })
  if (failure) {
    await stopWithSummary({
      github,
      config,
      pull,
      reviews,
      message: failure
    })
    return
  }
  assertNotSelfApproval(pull, config.expectedApprover)

  const liveHeadSha = pull.head.sha
  if (!(await validateWebsitePaths(github, config, pull, reviews))) return

  const recheckedReviews = await revalidatePull(github, config)
  if (!recheckedReviews) return

  const approved = await approveCurrentHead(
    github,
    config,
    liveHeadSha,
    recheckedReviews
  )
  if (!approved) return

  const queuePull = await github.request(`/pulls/${config.prNumber}`)
  await armMergeAutomation(github, queuePull)

  // Recheck once more after arming. A concurrent hold, new commit, or human
  // change request must withdraw both the policy approval and merge intent.
  await revalidatePull(github, config)
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    process.exitCode = 1
  })
}
