#!/usr/bin/env tsx
/**
 * Deletes a `core/X.Y` or `cloud/X.Y` backport target label once its release
 * line can no longer ship.
 *
 * `release-branch-create.yaml` creates both labels at each minor cut. Its old
 * prune step listed only the first 200 labels, so once the repo passed 200 it
 * saw three per prefix, decided there was nothing to prune, and every label
 * since 1.52 stayed. A line's label is useful only while that line can still
 * ship, and a line stops shipping the moment its product moves past it: a
 * rollback is a fix-forward emergency, not a reason to backport to the old line.
 *
 * What counts as live is read from what users are actually served, so it holds
 * however a build reached them (canary, a skipped canary, a hotfix):
 *   - cloud: the SHA cloud.comfy.org serves, mapped to the `cloud/*` branch
 *     that contains it. That line and every newer one are kept.
 *   - core: the frontend version ComfyUI pins on `master` and on its latest
 *     release tag. The oldest pinned line and every newer one are kept.
 *
 * Before a label is deleted, every open PR still waiting on a backport to that
 * line (`needs-backport` plus the label) gets a comment, because on those PRs
 * the label is the only record that the backport was requested.
 */
import { execFileSync } from 'child_process'
import { appendFileSync, writeFileSync } from 'fs'
import { parseArgs } from 'node:util'

import { isMainModule } from '../isMainModule'
import {
  minorLineOf,
  parsePinnedVersion
} from './check-stranded-release-commits'

export type Product = 'core' | 'cloud'

export interface ReleaseLine {
  major: number
  minor: number
}

const TARGET_LABEL = /^(core|cloud)\/(\d+)\.(\d+)$/

/** `cloud/1.55` → `{ product: 'cloud', line: 1.55 }`. Null for any other name. */
export function parseTargetLabel(
  name: string
): { product: Product; line: ReleaseLine } | null {
  const match = TARGET_LABEL.exec(name)
  if (!match) return null
  return {
    product: match[1] as Product,
    line: { major: Number(match[2]), minor: Number(match[3]) }
  }
}

/** `1.55` → `{ major: 1, minor: 55 }`. Null unless the input is exactly X.Y. */
export function parseLine(value: string): ReleaseLine | null {
  const match = /^(\d+)\.(\d+)$/.exec(value.trim())
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : null
}

export function compareLines(a: ReleaseLine, b: ReleaseLine): number {
  return a.major - b.major || a.minor - b.minor
}

export function formatLine({ major, minor }: ReleaseLine): string {
  return `${major}.${minor}`
}

/**
 * The oldest line still in use. Cloud passes every `cloud/*` branch that
 * contains the served SHA (a fork-point commit is on more than one), core
 * passes each pinned line. Taking the oldest keeps more, never fewer.
 */
export function oldestLine(lines: ReleaseLine[]): ReleaseLine | null {
  return [...lines].sort(compareLines)[0] ?? null
}

export interface RetirementPlan {
  keepFrom: ReleaseLine
  retire: string[]
}

/**
 * Labels of `product` strictly older than `keepFrom`, oldest first.
 *
 * Refuses (throws) when `keepFrom` is newer than every label of that product:
 * that means the live signal points past the newest cut, so the signal or the
 * branch mapping is wrong, and acting on it would delete every label.
 */
export function planRetirement({
  labels,
  product,
  keepFrom
}: {
  labels: string[]
  product: Product
  keepFrom: ReleaseLine
}): RetirementPlan {
  const own = labels
    .map((name) => ({ name, parsed: parseTargetLabel(name) }))
    .filter(
      (
        l
      ): l is {
        name: string
        parsed: { product: Product; line: ReleaseLine }
      } => l.parsed !== null && l.parsed.product === product
    )
    .sort((a, b) => compareLines(a.parsed.line, b.parsed.line))

  const newest = own.at(-1)
  if (newest && compareLines(keepFrom, newest.parsed.line) > 0) {
    throw new Error(
      `Live ${product} line ${formatLine(keepFrom)} is newer than the newest ` +
        `label ${newest.name}; refusing to delete anything.`
    )
  }

  return {
    keepFrom,
    retire: own
      .filter((l) => compareLines(l.parsed.line, keepFrom) < 0)
      .map((l) => l.name)
  }
}

/**
 * The one comment left on a PR that still asks for backports to retired lines.
 * One per PR per run, however many of its labels are retired.
 */
export function retirementComment(
  labels: string[],
  product: Product,
  keepFrom: string
): string {
  const names = labels.map((l) => `\`${l}\``).join(', ')
  const single = labels.length === 1
  return [
    `${names} ${single ? 'no longer ships' : 'no longer ship'}: ${product} has moved to ${product}/${keepFrom}, so ${single ? 'the label is' : 'these labels are'} being deleted.`,
    '',
    `If this fix still needs to reach users, label it for ${product}/${keepFrom} or newer instead. Otherwise remove \`needs-backport\`.`,
    '',
    '_Posted by `release-label-retire.yaml`._'
  ].join('\n')
}

/** Group "PR waits on label" pairs into one entry per PR, labels in order. */
export function groupByPr<T extends { number: number }>(
  pairs: { label: string; pr: T }[]
): { pr: T; labels: string[] }[] {
  const byNumber = new Map<number, { pr: T; labels: string[] }>()
  for (const { label, pr } of pairs) {
    const entry = byNumber.get(pr.number) ?? { pr, labels: [] }
    entry.labels.push(label)
    byNumber.set(pr.number, entry)
  }
  return [...byNumber.values()]
}

/** `cloud/1.55` → `cloud%2F1.55`, the form the labels REST endpoint expects. */
export function labelPath(label: string): string {
  return encodeURIComponent(label)
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

const REPO = process.env.GITHUB_REPOSITORY ?? 'Comfy-Org/ComfyUI_frontend'
const CLOUD_URL = 'https://cloud.comfy.org/'
const COMFYUI_REPO = 'Comfy-Org/ComfyUI'

function run(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  }).trim()
}

function gh(...args: string[]): string {
  return run('gh', args)
}

async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`)
  return response
}

async function servedCloudSha(): Promise<string> {
  const response = await fetchOk(CLOUD_URL, { method: 'HEAD' })
  const sha = response.headers.get('x-frontend-version')?.trim()
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`${CLOUD_URL} served no usable x-frontend-version (${sha})`)
  }
  return sha
}

function cloudLinesContaining(sha: string): ReleaseLine[] {
  const branches = run('git', [
    'for-each-ref',
    '--format=%(refname:lstrip=4)',
    '--contains',
    sha,
    'refs/remotes/origin/cloud/'
  ])
  return branches
    .split('\n')
    .map((b) => parseLine(b.trim()))
    .filter((l): l is ReleaseLine => l !== null)
}

async function cloudKeepFrom(): Promise<{
  keepFrom: ReleaseLine
  why: string
}> {
  const sha = await servedCloudSha()
  const keepFrom = oldestLine(cloudLinesContaining(sha))
  if (!keepFrom) {
    throw new Error(`Served SHA ${sha} is on no cloud/* branch`)
  }
  return {
    keepFrom,
    why: `cloud.comfy.org serves ${sha.slice(0, 8)} (cloud/${formatLine(keepFrom)})`
  }
}

async function corePins(): Promise<{ ref: string; version: string }[]> {
  const tag = JSON.parse(
    gh('api', `repos/${COMFYUI_REPO}/releases/latest`)
  ) as { tag_name?: string }
  if (!tag.tag_name) throw new Error('ComfyUI has no latest release')

  return Promise.all(
    ['master', tag.tag_name].map(async (ref) => {
      const response = await fetchOk(
        `https://raw.githubusercontent.com/${COMFYUI_REPO}/${ref}/requirements.txt`
      )
      const version = parsePinnedVersion(await response.text())
      if (!version)
        throw new Error(`No frontend pin in requirements.txt @ ${ref}`)
      return { ref, version }
    })
  )
}

async function coreKeepFrom(): Promise<{ keepFrom: ReleaseLine; why: string }> {
  const pins = await corePins()
  const lines = pins
    .map((p) => minorLineOf(p.version))
    .map((l) => (l ? parseLine(l) : null))
    .filter((l): l is ReleaseLine => l !== null)
  const keepFrom = oldestLine(lines)
  if (!keepFrom) throw new Error('Could not read a pinned core line')
  return {
    keepFrom,
    why: `ComfyUI pins ${pins.map((p) => `${p.version} @ ${p.ref}`).join(', ')}`
  }
}

function allLabels(): string[] {
  return gh(
    'api',
    '--paginate',
    `repos/${REPO}/labels?per_page=100`,
    '--jq',
    '.[].name'
  )
    .split('\n')
    .filter(Boolean)
}

interface PrRef {
  number: number
  title: string
  html_url: string
}

/**
 * Open PRs that still ask for a backport to `label`. REST search, no `read:org`.
 *
 * Open only: a merged PR that kept `needs-backport` had a backport fail on some
 * line, and once that line is dead the leftover label is history, not a task.
 * Commenting on those would post dozens of comments per retired line.
 */
function prsWaitingOn(label: string): PrRef[] {
  const q = `repo:${REPO} is:pr is:open label:needs-backport label:"${label}"`
  const raw = gh(
    'api',
    '-X',
    'GET',
    'search/issues',
    '-f',
    `q=${q}`,
    '-f',
    'per_page=100',
    '--jq',
    '[.items[] | {number, title, html_url}]'
  )
  return JSON.parse(raw) as PrRef[]
}

/** Open PRs whose base is the retired branch, for the sheriff to close or land. */
function openPrsAgainst(branch: string): PrRef[] {
  const raw = gh(
    'api',
    `repos/${REPO}/pulls?state=open&base=${encodeURIComponent(branch)}&per_page=100`,
    '--jq',
    '[.[] | {number, title, html_url}]'
  )
  return JSON.parse(raw) as PrRef[]
}

interface LabelRetirement {
  label: string
  waiting: PrRef[]
  open: PrRef[]
}

/** One report line per retired label, Slack mrkdwn links. */
export function reportLine(
  { label, waiting, open }: LabelRetirement,
  dryRun: boolean
): string {
  const link = (p: PrRef) => `<${p.html_url}|#${p.number}>`
  const parts = [`• ${dryRun ? 'Would delete' : 'Deleted'} \`${label}\``]
  if (waiting.length > 0) {
    const verb = dryRun ? 'would comment on' : 'commented on'
    parts.push(`${verb} ${waiting.map(link).join(', ')}`)
  }
  if (open.length > 0) {
    parts.push(`still open against the branch: ${open.map(link).join(', ')}`)
  }
  return parts.join('; ')
}

function readArgs(): { product: Product; dryRun: boolean; report: string } {
  const { values } = parseArgs({
    options: {
      product: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      report: { type: 'string', default: 'report.md' }
    }
  })
  const { product } = values
  if (product !== 'core' && product !== 'cloud') {
    throw new Error('--product must be core or cloud')
  }
  return { product, dryRun: values['dry-run'], report: values.report }
}

/**
 * Comment, then delete. Once the label is gone, the comment is the only record
 * on these PRs that the backport was ever requested.
 */
function applyRetirements(
  retirements: LabelRetirement[],
  product: Product,
  keepFrom: string
): void {
  const pairs = retirements.flatMap(({ label, waiting }) =>
    waiting.map((pr) => ({ label, pr }))
  )
  for (const { pr, labels } of groupByPr(pairs)) {
    gh(
      'api',
      '--silent',
      `repos/${REPO}/issues/${pr.number}/comments`,
      '-f',
      `body=${retirementComment(labels, product, keepFrom)}`
    )
  }
  for (const { label } of retirements) {
    gh(
      'api',
      '--silent',
      '-X',
      'DELETE',
      `repos/${REPO}/labels/${labelPath(label)}`
    )
  }
}

async function main(): Promise<void> {
  const { product, dryRun, report } = readArgs()

  // A signal that can't be read throws here, before anything is touched.
  const { keepFrom, why } =
    product === 'cloud' ? await cloudKeepFrom() : await coreKeepFrom()
  const plan = planRetirement({ labels: allLabels(), product, keepFrom })
  const keep = formatLine(keepFrom)

  const header = `*${product}*: ${why}. Keeping ${product}/${keep} and newer.`
  console.error(header)

  const retirements = plan.retire.map((label) => ({
    label,
    waiting: prsWaitingOn(label),
    open: openPrsAgainst(label)
  }))
  if (!dryRun) applyRetirements(retirements, product, keep)

  const lines = retirements.map((r) => reportLine(r, dryRun))
  for (const line of lines) console.error(line)
  if (lines.length === 0) console.error('Nothing to retire.')

  writeFileSync(report, lines.length > 0 ? [header, ...lines].join('\n') : '')
  if (process.env.GITHUB_OUTPUT && plan.retire.length > 0) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `retired=${plan.retire.join(' ')}\n`
    )
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
