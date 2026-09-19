#!/usr/bin/env tsx
/**
 * Builds the Slack direct messages that go out the moment `needs-backport`
 * lands on a pull request.
 *
 * Why this exists: the label was only ever reported after the fact. The
 * release-cut digest in `#frontend-releases` lists which PRs still need a
 * backport, so the gap between somebody deciding a change has to ship on a
 * release line and anybody hearing about it was as wide as the gap between
 * releases. This runs on the label event itself.
 *
 * The label alone does not mean a backport will happen. `pr-backport.yaml`
 * only runs for pull requests into `main`, only once they are merged, and
 * exits with an error when no target-branch label is present. The message
 * therefore states which of those three the PR is currently missing — the
 * part a watcher would otherwise have to open the PR to work out.
 */
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

/** `pr-backport.yaml` is `on: pull_request_target: branches: [main]`. */
export const BACKPORT_SOURCE_BRANCH = 'main'

/**
 * Mirrors one iteration of `pr-backport.yaml`'s "Collect backport targets"
 * loop, including its order: the `branch:`/`backport:` prefixes win over the
 * bare forms, and a two-part version number means the core line.
 *
 * Divergence from that loop is the bug to avoid — a message that lists a
 * target the workflow will not act on, or omits one it will, is worse than no
 * message. The loop's `git ls-remote` existence check is applied separately by
 * `splitBackportTargets`, against the branch list the workflow reads.
 */
function targetFromLabel(label: string): string | null {
  const prefixed = /^(?:branch|backport):(.+)$/.exec(label)
  if (prefixed) return prefixed[1].trim()
  if (/^(?:core|cloud)\/\d+\.\d+$/.test(label)) return label
  if (/^\d+\.\d+$/.test(label)) return `core/${label}`
  return null
}

/** The branches the labels ask `pr-backport.yaml` for, in label order. */
export function backportTargetsFromLabels(labels: readonly string[]): string[] {
  const targets = labels
    .map(targetFromLabel)
    .filter((target): target is string => !!target)
  return [...new Set(targets)]
}

export interface BackportTargets {
  /** Requested by a label and present on the remote. */
  known: string[]
  /** Requested by a label with no such branch, which `pr-backport.yaml` drops. */
  unknown: string[]
}

/**
 * Splits the requested targets by whether the branch exists yet.
 *
 * A label can name a release line before it is cut — `1.50` the week before
 * the minor bump creates `core/1.50`. `pr-backport.yaml` drops such a target
 * with a warning and fails outright when none survives, so promising a
 * cherry-pick into it would be a promise nothing keeps.
 *
 * `branches` is null when the remote could not be listed, in which case every
 * target is reported as known: an unavailable branch list is no evidence that
 * a branch is missing.
 */
export function splitBackportTargets(
  labels: readonly string[],
  branches: readonly string[] | null
): BackportTargets {
  const requested = backportTargetsFromLabels(labels)
  if (branches === null) return { known: requested, unknown: [] }

  const remote = new Set(branches)
  return {
    known: requested.filter((target) => remote.has(target)),
    unknown: requested.filter((target) => !remote.has(target))
  }
}

/**
 * Slack requires these three escaped in message text, and a PR title is free
 * to contain all of them (`fix: treat a < b && c > d`). Left raw, a `>` ends
 * the `<url|label>` link early and the rest of the title becomes the message.
 */
export function escapeSlackText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** A member ID, `W…` on Enterprise Grid. Not a `D…` DM channel: nobody has
 * reason to configure one, and every extra accepted shape is one more way a
 * mistyped word reaches Slack as a recipient. */
const SLACK_ID_PATTERN = /^[UW][A-Z0-9]{7,}$/

/**
 * Turns the notification off, because an empty repository variable restores
 * the default watcher instead. Recognised by name rather than left to "any
 * value that is not an ID", which would otherwise fail the run: an entry
 * nobody can DM is exactly what this script is elsewhere required to be loud
 * about.
 */
const DISABLED_VALUES = new Set(['NONE', 'OFF', 'DISABLED'])

export interface SlackRecipients {
  /** Well-formed IDs, upper-cased to Slack's canonical form. */
  valid: string[]
  /** Entries left as written, so a typo can be recognised in the log. */
  invalid: string[]
  /** True when the list only asks for the notification to be turned off. */
  disabled: boolean
}

/**
 * Reads the watcher list, which is space- or comma-separated so either
 * spelling of the repository variable works.
 *
 * Malformed entries are reported rather than dropped: a Slack handle
 * (`@shihchi`) looks close enough to an ID that it would otherwise fail
 * silently, which is the failure mode this whole notification exists to end.
 */
export function parseSlackRecipients(raw: string | undefined): SlackRecipients {
  const valid: string[] = []
  const invalid: string[] = []
  let disabled = false

  for (const entry of new Set((raw ?? '').split(/[\s,]+/).filter(Boolean))) {
    const normalised = entry.toUpperCase()
    if (DISABLED_VALUES.has(normalised)) disabled = true
    else if (SLACK_ID_PATTERN.test(normalised)) valid.push(normalised)
    else invalid.push(entry)
  }

  return { valid: [...new Set(valid)], invalid, disabled }
}

/**
 * The REST API reports `state` and `merged` separately; a backport turns on
 * the difference between the two ways a PR is closed.
 */
export type PullRequestState = 'OPEN' | 'CLOSED' | 'MERGED'

export interface PullRequest {
  number: number
  title: string
  url: string
  author: string
  baseRef: string
  state: PullRequestState
  /** Every label on the PR, not just the one that was added. */
  labels: readonly string[]
}

export interface NeedsBackportEvent {
  pullRequest: PullRequest
  labeledBy: string
  /** Branch names on the remote, or null when they could not be listed. */
  remoteBranches: readonly string[] | null
}

// Backticks are dropped rather than escaped: Slack has no escape for one
// inside a code span, so a label carrying one would close the span early and
// spill the rest of the line out of it.
const code = (values: readonly string[]) =>
  values
    .map((value) => `\`${escapeSlackText(value).replaceAll('`', '')}\``)
    .join(', ')

/**
 * Shapes rather than a sample version, which would read as stale guidance
 * once the line moves on. No angle-bracket placeholders: Slack reads `<…>` as
 * a link and would swallow the very thing being pointed at.
 */
const LABEL_HINT =
  'Add a target label: a `major.minor` version, `core/major.minor`, `cloud/major.minor`, or `branch:` followed by a branch name.'

/**
 * Whether the PR is merged decides how to read every line below, and it is
 * what tells a typo apart from a deliberate label on a line that has not been
 * cut yet — so each of the three sentence builders takes it, and none of them
 * is written for only one state. `pr-backport.yaml` runs on merge and
 * re-checks the branches then, so nothing is yet wrong with an open PR.
 */
function uncutTargetWarning(unknown: string[], merged: boolean): string[] {
  if (unknown.length === 0) return []

  const one = unknown.length === 1
  return [
    merged
      ? `:warning: ${code(unknown)} ${one ? 'has' : 'have'} no branch on the remote, so *PR Backport* drops ${one ? 'it' : 'them'}.`
      : `:warning: ${code(unknown)} ${one ? 'has' : 'have'} no branch on the remote yet, and ${one ? 'needs' : 'need'} one by the time this merges.`
  ]
}

function noTargetWarning(merged: boolean): string {
  return merged
    ? `:warning: The PR is merged with no usable target branch label, so *PR Backport* fails. ${LABEL_HINT}`
    : `:warning: The PR is still open and has no usable target branch label yet — *PR Backport* needs one by the time it merges. ${LABEL_HINT}`
}

/**
 * "Attempt", because two of `pr-backport.yaml`'s later gates are not modelled
 * here: it skips a target that already has an open backport PR, and reports
 * "No backport needed" when the merge commit is already on the target — the
 * dual-homed case `docs/release-process.md` describes as routine right after
 * a minor bump. Both are outcomes a watcher is content with; promising a
 * cherry-pick that then does not appear is not.
 */
function cherryPickOutlook(known: string[], merged: boolean): string {
  return merged
    ? `The PR is merged, so *PR Backport* will attempt a cherry-pick into ${code(known)}.`
    : `The PR is still open — *PR Backport* will attempt a cherry-pick into ${code(known)} once it merges.`
}

/** What `pr-backport.yaml` will do with this PR, and when. */
function backportOutlook(pr: PullRequest, targets: BackportTargets): string[] {
  if (pr.baseRef !== BACKPORT_SOURCE_BRANCH) {
    return [
      `:warning: The base branch is ${code([pr.baseRef])}, but *PR Backport* only runs on pull requests into \`${BACKPORT_SOURCE_BRANCH}\`, so this label will not start one.`
    ]
  }

  if (pr.state === 'CLOSED') {
    return [
      ':warning: The PR was closed without merging, so *PR Backport* will not run.'
    ]
  }

  const merged = pr.state === 'MERGED'
  const uncut = uncutTargetWarning(targets.unknown, merged)

  return targets.known.length === 0
    ? [noTargetWarning(merged), ...uncut]
    : [cherryPickOutlook(targets.known, merged), ...uncut]
}

export function buildNeedsBackportText({
  pullRequest,
  labeledBy,
  remoteBranches
}: NeedsBackportEvent): string {
  return [
    `:label: \`needs-backport\` was added to <${pullRequest.url}|#${pullRequest.number} ${escapeSlackText(pullRequest.title)}>`,
    `Author: ${escapeSlackText(pullRequest.author)} · Labelled by: ${escapeSlackText(labeledBy)} · Base: ${code([pullRequest.baseRef])}`,
    ...backportOutlook(
      pullRequest,
      splitBackportTargets(pullRequest.labels, remoteBranches)
    )
  ].join('\n')
}

/** A ready-to-send `chat.postMessage` body per recipient. */
export interface SlackDirectMessage {
  channel: string
  text: string
}

export function buildDirectMessages(
  event: NeedsBackportEvent,
  recipients: readonly string[]
): SlackDirectMessage[] {
  const text = buildNeedsBackportText(event)
  return recipients.map((channel) => ({ channel, text }))
}

function setOutput(name: string, value: string) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) {
    process.stdout.write(`${name}=${value}\n`)
    return
  }
  appendFileSync(file, `${name}=${value}\n`)
}

/** The subset of `GET /repos/{owner}/{repo}/pulls/{number}` this reads. */
interface PullRequestResponse {
  number?: number
  title?: string
  html_url?: string
  user?: { login?: string }
  base?: { ref?: string }
  state?: string
  merged?: boolean
  labels?: { name?: string }[]
}

/**
 * Reads one REST pull request payload.
 *
 * The PR is read live rather than taken from the webhook payload, so these
 * fields are the script's contract with the API and every one of them is
 * checked: a field read as undefined would otherwise reach Slack as
 * `#NaN undefined`.
 */
export function parsePullRequest(json: string): PullRequest {
  const pr = JSON.parse(json) as PullRequestResponse

  const missing = (field: string): never => {
    // Truncated: the whole payload runs to kilobytes of nested JSON, and the
    // field name is the part worth reading.
    throw new Error(
      `The pull request payload has no ${field}: ${json.slice(0, 200)}`
    )
  }

  const state = (): PullRequestState => {
    if (pr.merged) return 'MERGED'
    if (pr.state === 'closed') return 'CLOSED'
    if (pr.state === 'open') return 'OPEN'
    return missing(`known state (got "${pr.state}")`)
  }

  return {
    number: Number.isInteger(pr.number) ? pr.number! : missing('number'),
    title: pr.title ?? missing('title'),
    url: pr.html_url ?? missing('html_url'),
    author: pr.user?.login ?? missing('user.login'),
    baseRef: pr.base?.ref ?? missing('base.ref'),
    state: state(),
    labels: (pr.labels ?? []).map(
      (label) => label.name ?? missing('label name')
    )
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is empty; the workflow must set it.`)
  return value
}

/**
 * The workflow leaves an empty file behind when `git ls-remote` fails, which
 * has to read as "could not be listed" and not as "the remote has no
 * branches" — the second would warn that every target is uncut.
 */
export function readRemoteBranches(path: string | undefined): string[] | null {
  if (!path || !existsSync(path)) return null
  const branches = readFileSync(path, 'utf8')
    .split('\n')
    .map((branch) => branch.trim())
    .filter(Boolean)
  return branches.length > 0 ? branches : null
}

export interface WatcherResolution {
  recipients: string[]
  /** Lines to print, each already carrying its own workflow-command prefix. */
  notices: string[]
  /** Whether the run should fail because nobody reliable was notified. */
  failed: boolean
}

/**
 * Decides who gets the DM and whether the run may pass.
 *
 * The send step is skipped when there is no recipient, and a skipped step is
 * a green step — so anything wrong with the watcher list has to be caught
 * here or it is not caught at all. A list that is entirely typos, or nothing
 * but separators, would otherwise end as a passing run that notified nobody:
 * the silent failure this whole notification exists to end, reproduced by the
 * notification itself.
 *
 * A single bad entry among good ones fails too, matching what happens when
 * Slack rejects one recipient of several: the others are still notified, and
 * the run still goes red. One watcher silently never hearing anything is the
 * case worth being loud about, but not at the price of the rest of the list.
 */
export function resolveWatchers(raw: string | undefined): WatcherResolution {
  const { valid, invalid, disabled } = parseSlackRecipients(raw)
  const notices = invalid.map(
    (entry) => `::warning::Ignoring watcher "${entry}": not a Slack member ID.`
  )

  // Only as the sole entry. `none U0BA79D8R1T` is somebody muting the
  // notification the quick way, without deleting IDs they would have to
  // retype — and honouring the IDs while ignoring the `none` silently does
  // the opposite of what they asked. Treated as the contradiction it is:
  // the watchers are notified, and the run says the list needs deciding.
  if (disabled) {
    if (valid.length === 0 && invalid.length === 0) {
      return {
        recipients: [],
        notices: [
          'SLACK_NEEDS_BACKPORT_WATCHERS turns the notification off; sending nothing.'
        ],
        failed: false
      }
    }

    return {
      recipients: valid,
      notices: [
        ...notices,
        '::error::SLACK_NEEDS_BACKPORT_WATCHERS both turns the notification off and names watchers; it has to be one or the other.'
      ],
      failed: true
    }
  }

  if (valid.length === 0) {
    return {
      recipients: [],
      notices: [
        ...notices,
        '::error::No usable Slack member ID in SLACK_NEEDS_BACKPORT_WATCHERS; nobody was notified.'
      ],
      failed: true
    }
  }

  if (invalid.length > 0) {
    return {
      recipients: valid,
      notices: [
        ...notices,
        `::error::${invalid.length} watcher(s) in SLACK_NEEDS_BACKPORT_WATCHERS are not Slack member IDs and were not notified.`
      ],
      failed: true
    }
  }

  return { recipients: valid, notices, failed: false }
}

function main() {
  const { values } = parseArgs({
    options: {
      pr: { type: 'string', default: 'pr.json' },
      branches: { type: 'string' },
      out: { type: 'string', default: 'slack-dms.json' }
    }
  })

  const event: NeedsBackportEvent = {
    pullRequest: parsePullRequest(readFileSync(values.pr, 'utf8')),
    labeledBy: requireEnv('LABELED_BY'),
    remoteBranches: readRemoteBranches(values.branches)
  }
  const { recipients, notices, failed } = resolveWatchers(
    process.env.SLACK_NEEDS_BACKPORT_WATCHERS
  )

  for (const notice of notices) process.stderr.write(`${notice}\n`)

  const messages = buildDirectMessages(event, recipients)
  writeFileSync(values.out, JSON.stringify(messages))
  setOutput('count', String(messages.length))

  process.stderr.write(
    `${recipients.length} recipient(s):\n${buildNeedsBackportText(event)}\n`
  )

  // Reported, not thrown. Exiting non-zero here would fail this step, and the
  // send step is guarded on `success()` — so a watcher list with one typo in
  // it would silence the DM to everyone else on the list, which is the
  // opposite of the point. A later step reads this and fails the run instead.
  setOutput('watchers_invalid', failed ? '1' : '0')
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
