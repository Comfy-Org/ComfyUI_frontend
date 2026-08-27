// Assigns the on-call release sheriff to backport, release version-bump and
// automation-authored PRs. Run by pr-assign-release-sheriff.yaml; details in
// docs/release-process.md.
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

// Layer members carry the rotation order, which is what makes "next" well
// defined. The graph is members -> user -> email, all in `included`.
export function parseRotationKeys(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.included)) return []

  const resources = payload.included.filter(isRecord)
  const find = (type: string, id: unknown) =>
    resources.find((r) => r.type === type && r.id === id)

  const memberIds = resources.flatMap((resource) => {
    if (resource.type !== 'layers' || !isRecord(resource.relationships))
      return []
    const { members } = resource.relationships
    if (!isRecord(members) || !Array.isArray(members.data)) return []
    return members.data.filter(isRecord).map((member) => member.id)
  })

  const keys = memberIds.flatMap((id) => {
    const member = find('members', id)
    if (!member || !isRecord(member.relationships)) return []
    const { user } = member.relationships
    if (!isRecord(user) || !isRecord(user.data)) return []
    const record = find('users', user.data.id)
    if (!record || !isRecord(record.attributes)) return []
    const { email } = record.attributes
    return typeof email === 'string' && email.trim() ? [emailKey(email)] : []
  })

  return [...new Set(keys)]
}

export interface DirectoryLookup {
  githubLoginByUser: Record<string, string>
  rotation: string[]
  // Rotation members with no github: tag. They break silently when their own
  // shift starts, weeks after the tag was forgotten, so surface them now.
  unmappedMembers: string[]
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
  const { payload, warning } = await datadogGet(config, credentials, '', {
    include: 'layers.members.user'
  })
  const githubLoginByUser = parseGithubLogins(payload)
  const keys = parseRotationKeys(payload)
  return {
    githubLoginByUser,
    rotation: keys.flatMap((key) => {
      const login = githubLoginByUser[key]
      return login ? [login] : []
    }),
    unmappedMembers: keys.filter((key) => !githubLoginByUser[key]),
    warning
  }
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

// Nobody owns what a robot opens: these sat unassigned for weeks, the oldest
// weeks old, because no human felt addressed by them. The sheriff owns them.
// gh reports GitHub Apps as "app/<slug>" and plain accounts by login.
const AUTOMATION_AUTHORS = [
  'app/dependabot',
  'app/cloud-code-bot',
  'comfy-pr-bot'
]

export function isSheriffPr(pr: PullRequestSummary): boolean {
  const labels = pr.labels.map((label) => label.name.toLowerCase())
  return (
    labels.includes('backport') ||
    pr.title.toLowerCase().startsWith(BACKPORT_TITLE) ||
    labels.includes('release') ||
    VERSION_BUMP_BRANCH.test(pr.headRefName) ||
    AUTOMATION_AUTHORS.includes(pr.author?.login ?? '')
  )
}

export interface SheriffAction {
  number: number
  assign: boolean
  requestReview: boolean
  reviewer: string | null
}

// Who reviews the sheriff's own PRs. GitHub rejects a self-review request, so
// without a standby the sheriff's backports were assigned to themselves with
// nobody asked to review — and backport merges are gated on an approval, so
// they waited on a review that had not been requested.
export function nextInRotation(
  rotation: string[],
  current: string
): string | null {
  const isCurrent = (login: string) =>
    login.toLowerCase() === current.toLowerCase()
  const start = rotation.findIndex(isCurrent)
  if (start === -1) return null

  for (let step = 1; step < rotation.length; step++) {
    const candidate = rotation[(start + step) % rotation.length]
    if (!isCurrent(candidate)) return candidate
  }
  return null
}

// Existing assignees and review requests are never overwritten, so a rotation
// handover does not churn open PRs and a human who picked one up keeps it.
export function planActions(
  prs: PullRequestSummary[],
  sheriffLogin: string,
  rotation: string[] = []
): SheriffAction[] {
  const normalized = sheriffLogin.toLowerCase()
  const standby = nextInRotation(rotation, sheriffLogin)

  return prs.flatMap((pr) => {
    if (pr.isDraft || !isSheriffPr(pr)) return []

    const assign = pr.assignees.length === 0
    const reviewer =
      pr.author?.login.toLowerCase() === normalized ? standby : sheriffLogin
    const normalizedReviewer = reviewer?.toLowerCase()
    const requestReview =
      reviewer !== null &&
      pr.reviewRequests.length === 0 &&
      pr.reviewDecision !== 'APPROVED' &&
      pr.author?.login.toLowerCase() !== normalizedReviewer &&
      !pr.latestReviews.some(
        (review) => review.author?.login.toLowerCase() === normalizedReviewer
      )

    return assign || requestReview
      ? [{ number: pr.number, assign, requestReview, reviewer }]
      : []
  })
}

const PR_FIELDS =
  'number,title,isDraft,headRefName,labels,assignees,reviewRequests,latestReviews,reviewDecision,author'

const QUERY_LIMIT = 100

function gh(args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf8' })
}

// GitHub's GraphQL API occasionally returns 502/503; retry with backoff before
// giving up so a transient gateway error doesn't degrade the whole run.
function ghWithRetry(args: string[], retries = 3): string {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return gh(args)
    } catch (err) {
      if (attempt === retries) throw err
      const delayMs = 2000 * attempt
      warn(
        `gh command failed (attempt ${attempt}/${retries}), retrying in ${delayMs}ms: ${String(err)}`
      )
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
    }
  }
  throw new Error('unreachable')
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
    ghWithRetry([...fixed, PR_FIELDS, ...selector])
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
    ...ghPrList(['--search', 'head:version-bump-']),
    ...AUTOMATION_AUTHORS.flatMap((author) =>
      ghPrList(['--search', `author:${author}`])
    )
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
  // Checked for the whole rotation, not just whoever is on call: a member
  // added without a tag works fine until their own shift begins, then falls
  // back silently. Fail now, while it is still someone else's week.
  for (const key of directory.unmappedMembers) {
    problems.push(
      `Rotation member "${key}" has no GitHub login and will fall back when ` +
        `their shift starts. Add "github:${key}:<github-login>" to the schedule.`
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

  if (directory.unmappedMembers.length > 0) {
    output('degraded', problems.join(' '))
    process.exitCode = 1
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

  const actions = planActions(collectCandidatePrs(), login, directory.rotation)
  summary(`### Release sheriff: \`${login}\` (via ${source})`)
  if (actions.length === 0) {
    summary('Nothing to do — every candidate PR already has an owner.')
    return
  }
  if (actions.some((action) => action.reviewer === null)) {
    warn(
      `${login} authored some of these PRs and the rotation offered no ` +
        'standby, so those still need a reviewer picked by hand.'
    )
  }

  for (const { number, assign, requestReview, reviewer } of actions) {
    if (assign) {
      const path = `repos/${repo}/issues/${number}/assignees`
      if (ghPost(path, `assignees[]=${login}`)) summary(`- Assigned #${number}`)
      else warn(`Could not assign #${number} to ${login}`)
    }

    // A failed review request (e.g. fork PRs) must not undo the assignment.
    if (requestReview && reviewer) {
      const path = `repos/${repo}/pulls/${number}/requested_reviewers`
      if (ghPost(path, `reviewers[]=${reviewer}`)) {
        summary(`- Requested review from \`${reviewer}\` on #${number}`)
      } else {
        warn(`Could not request review from ${reviewer} on #${number}`)
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
