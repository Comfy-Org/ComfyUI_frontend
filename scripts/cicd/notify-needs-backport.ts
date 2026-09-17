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
import { appendFileSync, writeFileSync } from 'node:fs'
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
 * message. Deliberately *not* mirrored is the workflow's `git ls-remote`
 * existence check: whether the branch exists is not knowable from the labels
 * and the workflow already warns about it where it can be.
 */
function targetFromLabel(label: string): string | null {
  const prefixed = /^(?:branch|backport):(.+)$/.exec(label)
  if (prefixed) return prefixed[1].trim()
  if (/^(?:core|cloud)\/\d+\.\d+$/.test(label)) return label
  if (/^\d+\.\d+$/.test(label)) return `core/${label}`
  return null
}

/** The branches `pr-backport.yaml` would cherry-pick into, in label order. */
export function backportTargetsFromLabels(labels: readonly string[]): string[] {
  const targets = labels
    .map(targetFromLabel)
    .filter((target): target is string => !!target)
  return [...new Set(targets)]
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

/** Member (`U`/`W`) or already-open DM channel (`D`). */
const SLACK_ID_PATTERN = /^[UWD][A-Z0-9]{7,}$/

export interface SlackRecipients {
  /** Well-formed IDs, upper-cased to Slack's canonical form. */
  valid: string[]
  /** Entries left as written, so a typo can be recognised in the log. */
  invalid: string[]
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

  for (const entry of new Set((raw ?? '').split(/[\s,]+/).filter(Boolean))) {
    const normalised = entry.toUpperCase()
    if (SLACK_ID_PATTERN.test(normalised)) valid.push(normalised)
    else invalid.push(entry)
  }

  return { valid: [...new Set(valid)], invalid }
}

export interface NeedsBackportEvent {
  prNumber: number
  prTitle: string
  prUrl: string
  prAuthor: string
  baseRef: string
  merged: boolean
  labeledBy: string
  /** Every label on the PR, not just the one that was added. */
  labels: readonly string[]
}

/** What `pr-backport.yaml` will do with this PR, and when. */
function backportOutlook(event: NeedsBackportEvent, targets: string[]): string {
  if (event.baseRef !== BACKPORT_SOURCE_BRANCH) {
    return `:warning: The base branch is \`${escapeSlackText(event.baseRef)}\`, but *PR Backport* only runs on pull requests into \`${BACKPORT_SOURCE_BRANCH}\`, so this label will not start one.`
  }

  if (targets.length === 0) {
    return ':warning: No target branch label yet — *PR Backport* fails without one. Add `1.47`, `core/1.47`, `cloud/1.47` or `branch:<branch>`.'
  }

  const list = targets
    .map((target) => `\`${escapeSlackText(target)}\``)
    .join(', ')
  return event.merged
    ? `The PR is merged, so *PR Backport* is cherry-picking into ${list} now.`
    : `The PR is still open — *PR Backport* will cherry-pick into ${list} once it merges.`
}

export function buildNeedsBackportText(event: NeedsBackportEvent): string {
  return [
    `:label: \`needs-backport\` was added to <${event.prUrl}|#${event.prNumber} ${escapeSlackText(event.prTitle)}>`,
    `Author: ${escapeSlackText(event.prAuthor)} · Labelled by: ${escapeSlackText(event.labeledBy)} · Base: \`${escapeSlackText(event.baseRef)}\``,
    backportOutlook(event, backportTargetsFromLabels(event.labels))
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

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is empty; the workflow must set it.`)
  return value
}

function readLabels(): string[] {
  const raw = process.env.PR_LABELS?.trim()
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error(`PR_LABELS is not a JSON array: ${raw}`)
  }
  return parsed.map(String)
}

function readEvent(): NeedsBackportEvent {
  const prNumber = Number(requireEnv('PR_NUMBER'))
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(`PR_NUMBER is not a pull request number: ${prNumber}`)
  }

  return {
    prNumber,
    prTitle: requireEnv('PR_TITLE'),
    prUrl: requireEnv('PR_URL'),
    prAuthor: requireEnv('PR_AUTHOR'),
    baseRef: requireEnv('PR_BASE_REF'),
    merged: process.env.PR_MERGED === 'true',
    labeledBy: requireEnv('LABELED_BY'),
    labels: readLabels()
  }
}

function main() {
  const { values } = parseArgs({
    options: { out: { type: 'string', default: 'slack-dms.json' } }
  })

  const event = readEvent()
  const { valid, invalid } = parseSlackRecipients(
    process.env.SLACK_NEEDS_BACKPORT_WATCHERS
  )

  for (const entry of invalid) {
    process.stderr.write(
      `::warning::Ignoring watcher "${entry}": not a Slack member ID.\n`
    )
  }
  if (valid.length === 0) {
    process.stderr.write(
      '::warning::No Slack watchers configured — set the SLACK_NEEDS_BACKPORT_WATCHERS repository variable to one or more Slack member IDs.\n'
    )
  }

  const messages = buildDirectMessages(event, valid)
  writeFileSync(values.out, JSON.stringify(messages))
  setOutput('count', String(messages.length))

  process.stderr.write(
    `${valid.length} recipient(s):\n${buildNeedsBackportText(event)}\n`
  )
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
