// Assigns the on-call release sheriff to backport and release version-bump PRs
// so they are never left unowned. Run by pr-assign-release-sheriff.yaml.
//
// Ask Datadog who is on call right now, map that person to a GitHub login, then
// assign them (and request their review) on every in-scope PR that has no owner
// yet. The rotation is read live, so a handover takes effect on the next run
// with no commit and no PR.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The rotation lives in Datadog On-Call. `githubLoginByEmail` is the one piece
// maintained by hand: Datadog stores no GitHub identity, and GitHub's
// email->user search only resolves *public* commit emails (org members keep
// theirs private), so mapping the on-call person's Datadog email to their
// GitHub login needs this table — add an entry when someone joins the rotation.
// `fallbackGithubLogin` owns PRs when Datadog is unreachable/unconfigured or the
// on-call user is unmapped, so a PR is never left without an owner.
const CONFIG = {
  datadogSite: 'datadoghq.com',
  // Empty until the Datadog schedule is created; while empty the workflow
  // falls back to `fallbackGithubLogin`.
  scheduleId: '',
  fallbackGithubLogin: 'christian-byrne',
  githubLoginByEmail: {} as Record<string, string>
}

export interface PullRequestSummary {
  number: number
  title: string
  isDraft: boolean
  headRefName: string
  labels: { name: string }[]
  assignees: { login: string }[]
  reviewRequests: { login?: string }[]
  reviewDecision: string | null
  author: { login: string } | null
}

function warn(message: string) {
  process.stderr.write(`::warning::${message}\n`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Pull the current on-call users out of a Datadog On-Call
 * `/schedules/{id}/responders` payload. Users arrive in the JSON:API
 * `included` array (requires `include=responders.shifts.user`), so the
 * responder/shift graph does not need to be walked to find them.
 */
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

export interface OnCallLookup {
  emails: string[]
  /** Set whenever the lookup could not produce an answer. */
  warning: string | null
}

/**
 * Ask Datadog who is on call right now. Every failure mode degrades to an empty
 * result plus a warning rather than throwing: an unreachable rotation must leave
 * PRs with the fallback owner, never unowned. The warning is returned, not
 * emitted, so the caller owns logging and the outcomes stay unit-testable.
 */
export async function fetchOnCallEmails(
  config: Pick<typeof CONFIG, 'datadogSite' | 'scheduleId'>,
  credentials: { apiKey?: string; appKey?: string }
): Promise<OnCallLookup> {
  const { datadogSite, scheduleId } = config
  const { apiKey, appKey } = credentials

  if (!scheduleId) {
    return {
      emails: [],
      warning: 'No Datadog On-Call schedule configured — using the fallback.'
    }
  }
  if (!apiKey || !appKey) {
    return {
      emails: [],
      warning:
        'DATADOG_API_KEY / DATADOG_APP_KEY unavailable — using the fallback.'
    }
  }

  const url = new URL(
    `https://api.${datadogSite}/api/v2/on-call/schedules/${scheduleId}/responders`
  )
  url.searchParams.set('include', 'responders.shifts.user')
  url.searchParams.set('filter[position]', 'current')

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
        emails: [],
        warning: `Datadog On-Call responded ${response.status} ${response.statusText} — using the fallback.`
      }
    }
    return { emails: parseOnCallEmails(await response.json()), warning: null }
  } catch (error) {
    return {
      emails: [],
      warning: `Datadog On-Call lookup failed (${String(error)}) — using the fallback.`
    }
  }
}

export interface SheriffResolution {
  login: string | null
  source: 'datadog' | 'fallback' | 'none'
  unmappedEmails: string[]
}

/** Map the first on-call email that has a GitHub login; otherwise fall back. */
export function resolveSheriff(
  emails: string[],
  config: Pick<typeof CONFIG, 'fallbackGithubLogin' | 'githubLoginByEmail'>
): SheriffResolution {
  const loginByEmail = new Map(
    Object.entries(config.githubLoginByEmail).map(([email, login]) => [
      email.toLowerCase(),
      login
    ])
  )

  const unmappedEmails: string[] = []
  for (const email of emails) {
    const login = loginByEmail.get(email.toLowerCase())
    if (login) return { login, source: 'datadog', unmappedEmails }
    unmappedEmails.push(email)
  }

  const fallback = config.fallbackGithubLogin.trim()
  return fallback
    ? { login: fallback, source: 'fallback', unmappedEmails }
    : { login: null, source: 'none', unmappedEmails }
}

// `release-version-bump.yaml` names its branch after the new version, so the
// version number must be matched — a plain `version-bump-*` prefix also catches
// ordinary feature branches like `version-bump-fix-subscription-i18n`.
const VERSION_BUMP_BRANCH = /^version-bump-\d+\.\d+\.\d+/

/** A PR the sheriff should own: a backport, or a release version-bump PR. */
export function isSheriffPr(pr: PullRequestSummary): boolean {
  const labels = pr.labels.map((label) => label.name.toLowerCase())
  return (
    labels.includes('backport') ||
    pr.title.toLowerCase().includes('backport') ||
    labels.includes('release') ||
    VERSION_BUMP_BRANCH.test(pr.headRefName)
  )
}

export interface SheriffAction {
  number: number
  assign: boolean
  requestReview: boolean
}

/**
 * Decide what to do with each PR. Existing assignees and review requests are
 * left alone so a human who already picked the PR up is never overwritten and a
 * rotation handover does not churn open PRs.
 */
export function planActions(
  prs: PullRequestSummary[],
  sheriffLogin: string
): SheriffAction[] {
  return prs.flatMap((pr) => {
    if (pr.isDraft || !isSheriffPr(pr)) return []

    const assign = pr.assignees.length === 0
    const requestReview =
      pr.reviewRequests.length === 0 &&
      pr.reviewDecision !== 'APPROVED' &&
      pr.author?.login !== sheriffLogin

    return assign || requestReview
      ? [{ number: pr.number, assign, requestReview }]
      : []
  })
}

const PR_FIELDS =
  'number,title,isDraft,headRefName,labels,assignees,reviewRequests,reviewDecision,author'

function gh(args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf8' })
}

function ghPrList(selector: string[]): PullRequestSummary[] {
  const fixed = ['pr', 'list', '--state', 'open', '--limit', '100', '--json']
  return JSON.parse(gh([...fixed, PR_FIELDS, ...selector]))
}

/**
 * The repo carries hundreds of open PRs, so instead of listing them all we run
 * a few narrow queries and merge. `head:version-bump-` also matches feature
 * branches; `isSheriffPr` filters those back out with the version-number rule.
 */
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

  const { emails, warning } = await fetchOnCallEmails(CONFIG, {
    apiKey: process.env.DATADOG_API_KEY,
    appKey: process.env.DATADOG_APP_KEY
  })
  if (warning) warn(warning)

  const { login, source, unmappedEmails } = resolveSheriff(emails, CONFIG)
  for (const email of unmappedEmails) {
    warn(`Datadog on-call user ${email} has no githubLoginByEmail entry.`)
  }
  if (!login) {
    warn('No release sheriff could be resolved — nothing will be assigned.')
    return
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

    // A review request can legitimately fail (e.g. the sheriff is not a
    // collaborator on a fork PR) and must not undo the assignment above.
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
