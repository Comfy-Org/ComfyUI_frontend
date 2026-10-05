// Assigns the release sheriff to backport, release version-bump and
// automation-authored PRs. Run by pr-assign-release-sheriff.yaml; details in
// docs/release-process.md.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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

// Who the sheriff is, declared in a reviewed file in this repo rather than read
// off the Datadog on-call rota: on-call pages for incidents and hands over
// weekly, the sheriff shepherds releases. Details in docs/release-process.md.
const SHERIFF_CONFIG_PATH = '.github/release-sheriff.json'

// GitHub's own username rule: alphanumeric with single internal hyphens, 39
// max. Syntax only — a well-formed login belonging to nobody still passes, and
// is caught at run time by assigneeAccepted instead.
const GITHUB_LOGIN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/

export interface SheriffConfig {
  sheriff: string
  backupReviewer: string
}

export interface SheriffConfigParse {
  config: SheriffConfig | null
  error: string | null
}

// Returns an error rather than falling back to someone: an unreadable sheriff
// declaration is a fault a human must fix, and assigning *somebody* while the
// file is wrong is how the previous placeholder config survived for weeks.
export function parseSheriffConfig(raw: string): SheriffConfigParse {
  const invalid = (reason: string): SheriffConfigParse => ({
    config: null,
    error: `${SHERIFF_CONFIG_PATH} ${reason}.`
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return invalid('is not valid JSON')
  }
  if (!isRecord(parsed) || Array.isArray(parsed)) {
    return invalid('is not a JSON object')
  }

  const usable = (value: unknown): value is string =>
    typeof value === 'string' && value.trim() !== ''
  const { sheriff, backupReviewer } = parsed
  if (!usable(sheriff)) return invalid('has no usable "sheriff" login')
  if (!usable(backupReviewer)) {
    return invalid('has no usable "backupReviewer" login')
  }
  for (const [field, login] of [
    ['sheriff', sheriff.trim()],
    ['backupReviewer', backupReviewer.trim()]
  ] as const) {
    if (!GITHUB_LOGIN.test(login)) {
      return invalid(
        `has no usable "${field}" login: "${login}" is not a GitHub username`
      )
    }
  }
  // GitHub rejects a self-review request, so a backup who is the sheriff leaves
  // sheriff-authored backports with nobody asked to review, waiting forever on
  // the approval backport-auto-merge.yaml gates the merge on. Fail the PR that
  // writes it rather than discovering it on a stalled release.
  if (sheriff.trim().toLowerCase() === backupReviewer.trim().toLowerCase()) {
    return invalid(
      'names the same login as both "sheriff" and "backupReviewer"'
    )
  }

  return {
    config: { sheriff: sheriff.trim(), backupReviewer: backupReviewer.trim() },
    error: null
  }
}

// An absent file yields no config and no error, so the Datadog path still runs.
// That branch is transitional and is removed with the Datadog lookup itself.
export function loadSheriffConfig(): SheriffConfigParse {
  let raw: string
  try {
    raw = readFileSync(
      new URL(`../../${SHERIFF_CONFIG_PATH}`, import.meta.url),
      'utf8'
    )
  } catch (cause) {
    // Only an absent file falls through to Datadog. A file that exists but
    // cannot be read is reported, because silently re-engaging the rotating
    // lookup is the coupling this declaration exists to remove.
    const code = (cause as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return { config: null, error: null }
    return {
      config: null,
      error: `${SHERIFF_CONFIG_PATH} could not be read (${code ?? 'unknown error'}).`
    }
  }
  return parseSheriffConfig(raw)
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

// Existing assignees and review requests are never overwritten, so a rotation
// handover does not churn open PRs and a human who picked one up keeps it.
export function planActions(
  prs: PullRequestSummary[],
  sheriffLogin: string,
  standby: string | null = null
): SheriffAction[] {
  const normalized = sheriffLogin.toLowerCase()

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

// Retried, because a 502 from one sweep would otherwise fail the run and page
// #frontend-releases for something the next sweep fixes by itself — the muting
// risk this workflow's own comments warn about.
//
// Fewer attempts than the read path, though: a read fails transiently (GraphQL
// 502/503), while these fail permanently far more often — 422 for a reviewer
// who is not a collaborator, 403 for an assignee without access. Backoff is
// 2000ms * attempt and `Atomics.wait` blocks, so a third attempt would stall
// the sweep six seconds per PR to re-confirm a certainty.
const MUTATION_ATTEMPTS = 2

function ghPost(path: string, field: string): boolean {
  try {
    ghWithRetry(
      ['api', '--method', 'POST', path, '-f', field, '--silent'],
      MUTATION_ATTEMPTS
    )
    return true
  } catch {
    return false
  }
}

// POST .../assignees silently ignores a login without push access and still
// answers 201 with the issue body, so the echoed assignees list is the only
// evidence the assignment actually took. A plain "did the call throw" check
// reports success for a PR that is still unowned.
export function assigneeAccepted(response: unknown, login: string): boolean {
  if (!isRecord(response) || !Array.isArray(response.assignees)) return false
  return response.assignees.some(
    (assignee) =>
      isRecord(assignee) &&
      typeof assignee.login === 'string' &&
      assignee.login.toLowerCase() === login.toLowerCase()
  )
}

// Adding an assignee is idempotent, so retrying a lost response re-reads the
// same list rather than double-assigning.
function ghAssign(path: string, login: string): boolean {
  try {
    const response: unknown = JSON.parse(
      ghWithRetry(
        ['api', '--method', 'POST', path, '-f', `assignees[]=${login}`],
        MUTATION_ATTEMPTS
      )
    )
    return assigneeAccepted(response, login)
  } catch {
    return false
  }
}

function assignSheriff(
  repo: string,
  { number }: SheriffAction,
  sheriff: string
): boolean {
  const path = `repos/${repo}/issues/${number}/assignees`
  if (ghAssign(path, sheriff)) {
    summary(`- Assigned #${number}`)
    return true
  }
  warn(`Could not confirm #${number} was assigned to ${sheriff}`)
  return false
}

function requestReviewFrom(
  repo: string,
  { number }: SheriffAction,
  reviewer: string
): boolean {
  const path = `repos/${repo}/pulls/${number}/requested_reviewers`
  if (ghPost(path, `reviewers[]=${reviewer}`)) {
    summary(`- Requested review from \`${reviewer}\` on #${number}`)
    return true
  }
  warn(`Could not request review from ${reviewer} on #${number}`)
  return false
}

// Reported once rather than per PR: `degraded` is a single workflow output, and
// appending a second record for one key is how a heredoc output misparses.
export function reportUnhandled(unhandled: string[]) {
  if (unhandled.length === 0) return
  output(
    'degraded',
    `${unhandled.join('; ')}. Cause not established: GitHub drops an assignee ` +
      'without push access and rejects a non-collaborator reviewer, but a ' +
      'failed or unreadable API call is indistinguishable here.'
  )
  process.exitCode = 1
}

// standby is `string`, not `string | null`: parseSheriffConfig has already
// proven backupReviewer non-empty and distinct from the sheriff, so unlike the
// old rotation lookup this one cannot come back empty-handed.
export function runAssignment(repo: string, sheriff: string, standby: string) {
  const actions = planActions(collectCandidatePrs(), sheriff, standby)
  summary(`### Release sheriff: \`${sheriff}\` (via ${SHERIFF_CONFIG_PATH})`)
  if (actions.length === 0) {
    summary('Nothing to do — every candidate PR already has an owner.')
    return
  }

  // The two calls are independent on purpose: a failed review request must not
  // undo an assignment that succeeded, and vice versa.
  const unhandled = actions.flatMap((action) => {
    const failures: string[] = []
    if (action.assign && !assignSheriff(repo, action, sheriff)) {
      failures.push(
        `#${action.number} is not confirmed assigned to \`${sheriff}\``
      )
    }
    const reviewer = action.requestReview ? action.reviewer : null
    if (reviewer && !requestReviewFrom(repo, action, reviewer)) {
      failures.push(
        `#${action.number} has no confirmed review request for \`${reviewer}\``
      )
    }
    return failures
  })
  reportUnhandled(unhandled)
}

function main() {
  const repo = process.env.GH_REPO
  if (!repo) throw new Error('GH_REPO is required')

  const { config, error } = loadSheriffConfig()
  // No fallback: there is no sensible person to guess at, and a bad
  // declaration should not have reached main in the first place -- the unit
  // suite parses the shipped file on every PR that touches it.
  if (!config) {
    const message = error ?? `${SHERIFF_CONFIG_PATH} is missing.`
    warn(message)
    output('degraded', message)
    process.exitCode = 1
    return
  }

  runAssignment(repo, config.sheriff, config.backupReviewer)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
