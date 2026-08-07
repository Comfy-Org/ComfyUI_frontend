// Assigns the on-call release sheriff to backport and release version-bump
// PRs. Run by pr-assign-release-sheriff.yaml; details in docs/release-process.md.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const CONFIG = {
  // The Comfy org lives on the us5 sub-domain; api.datadoghq.com 403s.
  datadogSite: 'us5.datadoghq.com',
  // "Frontend Team – Oncall Schedule", whose sole layer is "Release Sheriff".
  scheduleId: 'f3258942-c040-4c33-8228-63a03e9092d6',
  fallbackGithubLogin: 'christian-byrne'
}

export interface PullRequestSummary {
  number: number
  title: string
  isDraft: boolean
  headRefName: string
  labels: { name: string }[]
  assignees: { login: string }[]
  reviewRequests: { login?: string }[]
  latestReviews: { author: { login: string } | null }[]
  reviewDecision: string | null
  author: { login: string } | null
}

function warn(message: string) {
  process.stderr.write(`::warning::${message}\n`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Users arrive in the JSON:API `included` array (via
// include=responders.shifts.user), so the responder graph never needs walking.
export function parseOnCallEmails(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.included)) return []

  const emails = payload.included.flatMap((resource) => {
    if (!isRecord(resource) || resource.type !== 'users') return []
    if (!isRecord(resource.attributes)) return []
    const { email } = resource.attributes
    return typeof email === 'string' && email.trim() ? [email.trim()] : []
  })

  return [...new Set(emails)]
}

// Datadog holds no GitHub identity, and GitHub only resolves commit emails its
// users chose to make public — three of seven sheriffs are unresolvable that
// way. The bridge is therefore declared on the schedule itself, as tags of the
// form github:<datadog-email-local-part>:<github-login>, so a rotation change
// stays a Datadog edit. Datadog rejects "@" and "+" outright and lower-cases
// what it does accept; GitHub logins are case-insensitive, so that is lossless.
const GITHUB_LOGIN_TAG = /^github:([^:]+):([^:]+)$/

export function emailKey(email: string): string {
  return email.split('@')[0].trim().toLowerCase()
}

export function parseGithubLogins(payload: unknown): Record<string, string> {
  if (!isRecord(payload) || !isRecord(payload.data)) return {}
  const { attributes } = payload.data
  if (!isRecord(attributes) || !Array.isArray(attributes.tags)) return {}

  return Object.fromEntries(
    attributes.tags.flatMap((tag) => {
      const match = typeof tag === 'string' ? GITHUB_LOGIN_TAG.exec(tag) : null
      return match ? [[match[1].toLowerCase(), match[2]]] : []
    })
  )
}

export interface OnCallLookup {
  emails: string[]
  warning: string | null
}

export interface DirectoryLookup {
  githubLoginByUser: Record<string, string>
  warning: string | null
}

interface DatadogResponse {
  payload: unknown
  warning: string | null
}

// Every failure degrades to an empty payload plus a returned warning: PRs must
// end up with the fallback owner, never unowned, and the caller owns logging.
async function datadogGet(
  config: Pick<typeof CONFIG, 'datadogSite' | 'scheduleId'>,
  credentials: { apiKey?: string; appKey?: string },
  path: string,
  query: Record<string, string> = {}
): Promise<DatadogResponse> {
  const { datadogSite, scheduleId } = config
  const { apiKey, appKey } = credentials

  if (!scheduleId) {
    return {
      payload: null,
      warning: 'No Datadog On-Call schedule configured — using the fallback.'
    }
  }
  if (!apiKey || !appKey) {
    return {
      payload: null,
      warning:
        'DATADOG_API_KEY / DATADOG_APP_KEY unavailable — using the fallback.'
    }
  }

  const url = new URL(
    `https://api.${datadogSite}/api/v2/on-call/schedules/${scheduleId}${path}`
  )
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey
      },
      signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) {
      return {
        payload: null,
        warning: `Datadog On-Call responded ${response.status} ${response.statusText} — using the fallback.`
      }
    }
    return { payload: await response.json(), warning: null }
  } catch (error) {
    return {
      payload: null,
      warning: `Datadog On-Call lookup failed (${String(error)}) — using the fallback.`
    }
  }
}

export async function fetchOnCallEmails(
  config: Pick<typeof CONFIG, 'datadogSite' | 'scheduleId'>,
  credentials: { apiKey?: string; appKey?: string }
): Promise<OnCallLookup> {
  const { payload, warning } = await datadogGet(
    config,
    credentials,
    '/responders',
    { include: 'responders.shifts.user', 'filter[position]': 'current' }
  )
  return { emails: parseOnCallEmails(payload), warning }
}

export async function fetchGithubLogins(
  config: Pick<typeof CONFIG, 'datadogSite' | 'scheduleId'>,
  credentials: { apiKey?: string; appKey?: string }
): Promise<DirectoryLookup> {
  const { payload, warning } = await datadogGet(config, credentials, '')
  return { githubLoginByUser: parseGithubLogins(payload), warning }
}

export interface SheriffResolution {
  login: string | null
  source: 'datadog' | 'fallback' | 'none'
  unmappedEmails: string[]
}

export function resolveSheriff(
  emails: string[],
  config: Pick<typeof CONFIG, 'fallbackGithubLogin'> & {
    githubLoginByUser: Record<string, string>
  }
): SheriffResolution {
  const unmappedEmails: string[] = []
  for (const email of emails) {
    const login = config.githubLoginByUser[emailKey(email)]
    if (login) return { login, source: 'datadog', unmappedEmails }
    unmappedEmails.push(email)
  }

  const fallback = config.fallbackGithubLogin.trim()
  return fallback
    ? { login: fallback, source: 'fallback', unmappedEmails }
    : { login: null, source: 'none', unmappedEmails }
}

// The version number is required: a bare version-bump- prefix also matches
// feature branches like version-bump-fix-subscription-i18n.
const VERSION_BUMP_BRANCH = /^version-bump-\d+\.\d+\.\d+/
// pr-backport.yaml titles backports "[backport <target>] ..."; substring
// matching would also catch PRs that are merely about backports.
const BACKPORT_TITLE = '[backport'

export function isSheriffPr(pr: PullRequestSummary): boolean {
  const labels = pr.labels.map((label) => label.name.toLowerCase())
  return (
    labels.includes('backport') ||
    pr.title.toLowerCase().startsWith(BACKPORT_TITLE) ||
    labels.includes('release') ||
    VERSION_BUMP_BRANCH.test(pr.headRefName)
  )
}

export interface SheriffAction {
  number: number
  assign: boolean
  requestReview: boolean
}

// Existing assignees and review requests are never overwritten, so a rotation
// handover does not churn open PRs and a human who picked one up keeps it.
export function planActions(
  prs: PullRequestSummary[],
  sheriffLogin: string
): SheriffAction[] {
  const normalizedSheriffLogin = sheriffLogin.toLowerCase()

  return prs.flatMap((pr) => {
    if (pr.isDraft || !isSheriffPr(pr)) return []

    const assign = pr.assignees.length === 0
    const requestReview =
      pr.reviewRequests.length === 0 &&
      pr.reviewDecision !== 'APPROVED' &&
      pr.author?.login.toLowerCase() !== normalizedSheriffLogin &&
      !pr.latestReviews.some(
        (review) =>
          review.author?.login.toLowerCase() === normalizedSheriffLogin
      )

    return assign || requestReview
      ? [{ number: pr.number, assign, requestReview }]
      : []
  })
}

const PR_FIELDS =
  'number,title,isDraft,headRefName,labels,assignees,reviewRequests,latestReviews,reviewDecision,author'

const QUERY_LIMIT = 100

function gh(args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf8' })
}

function ghPrList(selector: string[]): PullRequestSummary[] {
  const fixed = [
    'pr',
    'list',
    '--state',
    'open',
    '--limit',
    String(QUERY_LIMIT),
    '--json'
  ]
  const prs = JSON.parse(
    gh([...fixed, PR_FIELDS, ...selector])
  ) as PullRequestSummary[]
  if (prs.length === QUERY_LIMIT) {
    warn(
      `Candidate query "${selector.join(' ')}" returned ${QUERY_LIMIT} results and may be truncated.`
    )
  }
  return prs
}

// The repo carries hundreds of open PRs; narrow queries merged by number beat
// listing everything. isSheriffPr re-filters the over-broad selectors.
function collectCandidatePrs(): PullRequestSummary[] {
  const found = [
    ...ghPrList(['--label', 'backport']),
    ...ghPrList(['--label', 'Release']),
    ...ghPrList(['--search', 'backport in:title']),
    ...ghPrList(['--search', 'head:version-bump-'])
  ]
  const byNumber = new Map(found.map((pr) => [pr.number, pr]))
  return [...byNumber.values()]
}

function summary(line: string) {
  const file = process.env.GITHUB_STEP_SUMMARY
  if (file) appendFileSync(file, `${line}\n`)
}

// A heredoc output ends at the first line equal to its delimiter, so a value
// carrying that line would close the record early and let the rest parse as
// further outputs. These messages are one line by construction; enforcing that
// removes the possibility rather than picking a delimiter and hoping.
export function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// Read by the workflow's failure step to say why in Slack, so the alert is
// actionable without opening the run.
function output(key: string, value: string) {
  const file = process.env.GITHUB_OUTPUT
  if (file) {
    appendFileSync(file, `${key}<<__EOF__\n${singleLine(value)}\n__EOF__\n`)
  }
}

function ghPost(path: string, field: string): boolean {
  try {
    gh(['api', '--method', 'POST', path, '-f', field, '--silent'])
    return true
  } catch {
    return false
  }
}

async function main() {
  const repo = process.env.GH_REPO
  if (!repo) throw new Error('GH_REPO is required')

  const credentials = {
    apiKey: process.env.DATADOG_API_KEY,
    appKey: process.env.DATADOG_APP_KEY
  }
  const [oncall, directory] = await Promise.all([
    fetchOnCallEmails(CONFIG, credentials),
    fetchGithubLogins(CONFIG, credentials)
  ])
  // Both lookups hit the same API, so a credentials or outage failure arrives
  // twice; the Slack alert should say it once.
  const problems = [
    ...new Set([oncall.warning, directory.warning].filter((w) => w !== null))
  ]

  const { login, source, unmappedEmails } = resolveSheriff(oncall.emails, {
    ...CONFIG,
    githubLoginByUser: directory.githubLoginByUser
  })
  // Keyed, not the full address: this repo is public, so the warning lands in
  // public Actions logs and in Slack. The key is what the tag needs anyway.
  for (const email of unmappedEmails) {
    problems.push(
      `Datadog on-call user "${emailKey(email)}" has no GitHub login. Add ` +
        `the tag "github:${emailKey(email)}:<github-login>" to the schedule.`
    )
  }
  for (const problem of problems) warn(problem)
  if (!login) {
    const message = 'No release sheriff could be resolved — nothing assigned.'
    warn(message)
    output('degraded', [message, ...problems].join(' '))
    process.exitCode = 1
    return
  }

  // Falling back still assigns, so PRs stay owned, but the run must not go
  // green: this job warned "No Datadog On-Call schedule configured" on every
  // run for weeks and nobody noticed, because a warning alone reports success.
  if (source !== 'datadog') {
    output(
      'degraded',
      `Fell back to \`${login}\` instead of the Datadog on-call user. ` +
        problems.join(' ')
    )
    process.exitCode = 1
  }

  const actions = planActions(collectCandidatePrs(), login)
  summary(`### Release sheriff: \`${login}\` (via ${source})`)
  if (actions.length === 0) {
    summary('Nothing to do — every candidate PR already has an owner.')
    return
  }

  for (const { number, assign, requestReview } of actions) {
    if (assign) {
      const path = `repos/${repo}/issues/${number}/assignees`
      if (ghPost(path, `assignees[]=${login}`)) summary(`- Assigned #${number}`)
      else warn(`Could not assign #${number} to ${login}`)
    }

    // A failed review request (e.g. fork PRs) must not undo the assignment.
    if (requestReview) {
      const path = `repos/${repo}/pulls/${number}/requested_reviewers`
      if (ghPost(path, `reviewers[]=${login}`)) {
        summary(`- Requested review on #${number}`)
      } else {
        warn(`Could not request review from ${login} on #${number}`)
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
