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
      `WEBSITE_AUTO_APPROVE_AUTHORS must be JSON: ${error.message}`
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

export function changedPaths(files) {
  const paths = []
  for (const file of files) {
    if (typeof file?.filename !== 'string') return null
    paths.push(file.filename)
    if (file.status === 'renamed') {
      if (typeof file.previous_filename !== 'string') return null
      paths.push(file.previous_filename)
    }
  }
  return paths
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
  return reviews.some(
    (review) =>
      review?.state === 'APPROVED' &&
      review?.commit_id === headSha &&
      review?.user?.login?.toLowerCase() === expectedLogin
  )
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
    const url = requestPath.startsWith('https://')
      ? requestPath
      : `${root}${requestPath}`
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers }
    })
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500)
      throw new Error(
        `GitHub API ${options.method ?? 'GET'} ${requestPath} failed: ${response.status} ${body}`
      )
    }
    if (response.status === 204) return null
    return response.json()
  }

  async function paginate(requestPath) {
    const rows = []
    for (let page = 1; ; page += 1) {
      const separator = requestPath.includes('?') ? '&' : '?'
      const body = await request(
        `${requestPath}${separator}per_page=${PAGE_SIZE}&page=${page}`
      )
      if (!Array.isArray(body))
        throw new Error(`GitHub API ${requestPath} did not return an array`)
      rows.push(...body)
      if (body.length < PAGE_SIZE) return rows
    }
  }

  return { paginate, request }
}

function summary(message) {
  process.stdout.write(`${message}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`)
  }
}

async function main() {
  const token = requiredEnv('WEBSITE_APPROVAL_TOKEN')
  const repository = requiredEnv('GITHUB_REPOSITORY')
  const prNumber = Number(requiredEnv('PR_NUMBER'))
  const eventHeadSha = requiredEnv('PR_HEAD_SHA')
  const defaultBranch = requiredEnv('WEBSITE_APPROVAL_BASE_REF')
  const expectedApprover = requiredEnv('WEBSITE_APPROVER_LOGIN')
  const approvedAuthors = parseApprovedAuthors(
    requiredEnv('WEBSITE_AUTO_APPROVE_AUTHORS')
  )
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0)
    throw new Error('PR_NUMBER must be positive')

  const github = githubClient(token, repository)
  const actor = await github.request('https://api.github.com/user')
  if (actor?.login?.toLowerCase() !== expectedApprover.toLowerCase()) {
    throw new Error(
      `WEBSITE_APPROVAL_TOKEN belongs to ${actor?.login ?? 'an unknown account'}, expected ${expectedApprover}`
    )
  }

  const pull = await github.request(`/pulls/${prNumber}`)
  const author = pull?.user?.login?.toLowerCase()
  const liveHeadSha = pull?.head?.sha

  if (pull?.state !== 'open' || pull?.draft) {
    summary('Skipped: the pull request is not open and ready for review.')
    return
  }
  if (!targetsDefaultBranch(pull, repository, defaultBranch)) {
    summary(
      `Skipped: website fast-lane approvals apply only to ${defaultBranch}.`
    )
    return
  }
  if (!isSameRepository(pull, repository)) {
    summary(
      'Skipped: website fast-lane approvals do not apply to fork pull requests.'
    )
    return
  }
  if (liveHeadSha !== eventHeadSha) {
    summary(
      'Skipped: the pull request head advanced after this workflow started.'
    )
    return
  }
  if (!author || !approvedAuthors.has(author)) {
    summary(
      `Skipped: @${author ?? 'unknown'} is not in the website fast-lane author allowlist.`
    )
    return
  }
  if (author === expectedApprover.toLowerCase()) {
    throw new Error('the approval bot cannot approve its own pull request')
  }

  const files = await github.paginate(`/pulls/${prNumber}/files`)
  const paths = changedPaths(files)
  if (paths === null || !isWebsiteOnly(paths)) {
    summary('Skipped: at least one changed file is outside apps/website/**.')
    return
  }

  const reviews = await github.paginate(`/pulls/${prNumber}/reviews`)
  if (alreadyApprovedCurrentHead(reviews, expectedApprover, liveHeadSha)) {
    summary(
      `Already approved ${liveHeadSha.slice(0, 12)} as @${expectedApprover}.`
    )
    return
  }

  await github.request(`/pulls/${prNumber}/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'APPROVE',
      commit_id: liveHeadSha,
      body: 'Automatically approved: trusted website fast-lane author; all changed files are under `apps/website/**`.'
    })
  })
  summary(`Approved ${liveHeadSha.slice(0, 12)} as @${expectedApprover}.`)
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
