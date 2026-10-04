import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API_VERSION = '2022-11-28'
const PAGE_SIZE = 100

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
  if (file.status !== 'renamed') return [file.filename]
  if (typeof file.previous_filename !== 'string') return null
  return [file.filename, file.previous_filename]
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

  return { paginate, request }
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
    prNumber: Number(requiredEnv('PR_NUMBER')),
    eventHeadSha: requiredEnv('PR_HEAD_SHA'),
    defaultBranch: requiredEnv('WEBSITE_APPROVAL_BASE_REF'),
    expectedApprover: requiredEnv('WEBSITE_APPROVER_LOGIN'),
    approvedAuthors: parseApprovedAuthors(
      requiredEnv('WEBSITE_AUTO_APPROVE_AUTHORS')
    )
  }
  if (!Number.isSafeInteger(config.prNumber) || config.prNumber <= 0) {
    throw new Error('PR_NUMBER must be positive')
  }
  return config
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

function authorFailure({ pull, config }) {
  const author = pull?.user?.login?.toLowerCase()
  if (author && config.approvedAuthors.has(author)) return
  return `Skipped: @${author ?? 'unknown'} is not in the website fast-lane author allowlist.`
}

const ELIGIBILITY_CHECKS = [
  readinessFailure,
  baseFailure,
  repositoryFailure,
  headFailure,
  authorFailure
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

async function main() {
  const config = configuration()
  const github = githubClient(config.token, config.repository)
  await assertApproverIdentity(github, config.expectedApprover)

  const pull = await github.request(`/pulls/${config.prNumber}`)
  const failure = eligibilityFailure({ pull, config })
  if (failure) {
    summary(failure)
    return
  }
  assertNotSelfApproval(pull, config.expectedApprover)

  const liveHeadSha = pull.head.sha

  const files = await github.paginate(`/pulls/${config.prNumber}/files`)
  if (!hasCompleteChangedFileList(files, pull.changed_files)) {
    summary('Skipped: could not enumerate every changed file.')
    return
  }
  const paths = changedPaths(files)
  if (paths === null || !isWebsiteOnly(paths)) {
    summary('Skipped: at least one changed file is outside apps/website/**.')
    return
  }

  const reviews = await github.paginate(`/pulls/${config.prNumber}/reviews`)
  const recheckedPull = await github.request(`/pulls/${config.prNumber}`)
  if (recheckedPull?.head?.sha !== liveHeadSha) {
    summary('Skipped: the pull request head advanced during validation.')
    return
  }
  if (
    alreadyApprovedCurrentHead(reviews, config.expectedApprover, liveHeadSha)
  ) {
    summary(
      `Already approved ${liveHeadSha.slice(0, 12)} as @${config.expectedApprover}.`
    )
    return
  }

  await github.request(`/pulls/${config.prNumber}/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'APPROVE',
      commit_id: liveHeadSha,
      body: 'Automatically approved: trusted website fast-lane author; all changed files are under `apps/website/**`.'
    })
  })
  summary(
    `Approved ${liveHeadSha.slice(0, 12)} as @${config.expectedApprover}.`
  )
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
