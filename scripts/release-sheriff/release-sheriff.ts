export interface ReleaseSheriffConfig {
  datadog: {
    /** Datadog site host suffix, e.g. `datadoghq.com` or `us5.datadoghq.com`. */
    site: string
    /** Datadog On-Call schedule holding the release sheriff rotation. */
    scheduleId: string
  }
  /** Used when Datadog is unreachable or the on-call user is unmapped. */
  fallbackGithubLogin: string
  /** Datadog user email to GitHub login. */
  githubLoginByEmail: Record<string, string>
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

const ONCALL_TIMEOUT_MS = 15_000

export interface DatadogCredentials {
  apiKey: string | undefined
  appKey: string | undefined
}

export interface OnCallLookup {
  emails: string[]
  /** Set whenever the lookup could not produce an answer. */
  warning: string | null
}

/**
 * Ask Datadog who is on call right now. Every failure mode degrades to an
 * empty result with a warning rather than throwing: an unreachable rotation
 * must leave PRs with the fallback owner, never unowned.
 */
export async function fetchOnCallEmails(
  config: ReleaseSheriffConfig,
  { apiKey, appKey }: DatadogCredentials
): Promise<OnCallLookup> {
  const { site, scheduleId } = config.datadog

  if (!scheduleId) {
    return {
      emails: [],
      warning:
        'No Datadog On-Call schedule configured in .github/release-sheriff.json'
    }
  }

  if (!apiKey || !appKey) {
    return {
      emails: [],
      warning: 'DATADOG_API_KEY / DATADOG_APP_KEY are not available'
    }
  }

  const url = new URL(
    `https://api.${site}/api/v2/on-call/schedules/${scheduleId}/responders`
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
      signal: AbortSignal.timeout(ONCALL_TIMEOUT_MS)
    })

    if (!response.ok) {
      return {
        emails: [],
        warning: `Datadog On-Call responded ${response.status} ${response.statusText}`
      }
    }

    return { emails: parseOnCallEmails(await response.json()), warning: null }
  } catch (error) {
    return {
      emails: [],
      warning: `Datadog On-Call lookup failed (${String(error)})`
    }
  }
}

export type SheriffSource = 'datadog' | 'fallback' | 'none'

export interface SheriffResolution {
  login: string | null
  source: SheriffSource
  email: string | null
  unmappedEmails: string[]
}

export function resolveSheriff(
  emails: string[],
  config: ReleaseSheriffConfig
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
    if (login) return { login, source: 'datadog', email, unmappedEmails }
    unmappedEmails.push(email)
  }

  const fallback = config.fallbackGithubLogin.trim()
  return fallback
    ? { login: fallback, source: 'fallback', email: null, unmappedEmails }
    : { login: null, source: 'none', email: null, unmappedEmails }
}

export type SheriffScope =
  | 'backport-label'
  | 'backport-title'
  | 'release-label'
  | 'version-bump-branch'

/**
 * `release-version-bump.yaml` names its branch after the new version, so the
 * version must be matched too — plain `version-bump-*` also catches ordinary
 * feature branches like `version-bump-fix-subscription-i18n`.
 */
const VERSION_BUMP_BRANCH = /^version-bump-\d+\.\d+\.\d+/

export function sheriffScopeOf(pr: PullRequestSummary): SheriffScope | null {
  const labels = pr.labels.map((label) => label.name.toLowerCase())

  if (labels.includes('backport')) return 'backport-label'
  if (pr.title.toLowerCase().includes('backport')) return 'backport-title'
  if (labels.includes('release')) return 'release-label'
  if (VERSION_BUMP_BRANCH.test(pr.headRefName)) return 'version-bump-branch'
  return null
}

export interface SheriffAction {
  number: number
  scope: SheriffScope
  assign: boolean
  requestReview: boolean
}

/**
 * Decide what to do with each PR. Existing assignees and existing review
 * requests are left alone so a human who has already picked the PR up is
 * never overwritten, and a rotation handover does not churn open PRs.
 */
export function planSheriffActions(
  prs: PullRequestSummary[],
  sheriffLogin: string
): SheriffAction[] {
  return prs.flatMap((pr) => {
    if (pr.isDraft) return []

    const scope = sheriffScopeOf(pr)
    if (!scope) return []

    const assign = pr.assignees.length === 0
    const requestReview =
      pr.reviewRequests.length === 0 &&
      pr.reviewDecision !== 'APPROVED' &&
      pr.author?.login !== sheriffLogin

    if (!assign && !requestReview) return []
    return [{ number: pr.number, scope, assign, requestReview }]
  })
}
