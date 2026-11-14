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
 * Most labels one run may delete per product. The first run after this ships
 * retires four cloud lines, the largest backlog expected; after that a run
 * retires one line at most. More than this means the live signal or the
 * branch mapping moved further than any real release does.
 */
export const DEFAULT_MAX_PER_RUN = 4

/**
 * Labels of `product` strictly older than `keepFrom`, oldest first.
 *
 * Refuses (throws) when `keepFrom` is newer than every label of that product,
 * which means the live signal points past the newest cut, or when more than
 * `maxPerRun` labels would go. Either way the signal or the branch mapping is
 * wrong, and acting on it would delete labels that still ship.
 */
export function planRetirement({
  labels,
  product,
  keepFrom,
  maxPerRun = DEFAULT_MAX_PER_RUN
}: {
  labels: string[]
  product: Product
  keepFrom: ReleaseLine
  maxPerRun?: number
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

  const retire = own
    .filter((l) => compareLines(l.parsed.line, keepFrom) < 0)
    .map((l) => l.name)
  if (retire.length > maxPerRun) {
    throw new Error(
      `Would delete ${retire.length} ${product} labels (${retire.join(', ')}), ` +
        `more than the ${maxPerRun} allowed per run; refusing. Check the live ` +
        `line, then re-run with a higher max_per_run if it is right.`
    )
  }
  return { keepFrom, retire }
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
    ...labels.map(retirementMarker),
    `${names} ${single ? 'no longer ships' : 'no longer ship'}: ${product} has moved to ${product}/${keepFrom}, so ${single ? 'the label is' : 'these labels are'} being deleted.`,
    '',
    `If this fix still needs to reach users, label it for ${product}/${keepFrom} or newer instead. Otherwise remove \`needs-backport\`.`,
    '',
    '_Posted by `release-label-retire.yaml`._'
  ].join('\n')
}

/** Hidden line that records which label a retirement comment covered. */
export function retirementMarker(label: string): string {
  return `<!-- release-label-retire: ${label} -->`
}

/**
 * Labels not yet covered by an earlier retirement comment on the PR. A run that
 * commented and then failed to delete leaves the label in place; the next run
 * must not comment on the same PR again for it.
 */
export function labelsToNote(
  existingBodies: string[],
  labels: string[]
): string[] {
  return labels.filter(
    (label) =>
      !existingBodies.some((body) => body.includes(retirementMarker(label)))
  )
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
// Orchestration. Every read and write goes through RetireDeps so the ordering
// and fail-closed rules below are tested without network access.
// ---------------------------------------------------------------------------

export interface PrRef {
  number: number
  title: string
  html_url: string
}

export interface RetireDeps {
  /** Raw `x-frontend-version` from cloud.comfy.org, or null if absent. */
  servedCloudSha(): Promise<string | null>
  /** `X.Y` suffixes of every `cloud/*` branch that contains `sha`. */
  cloudBranchesContaining(sha: string): string[]
  /** Tag of ComfyUI's latest release, or null if there is none. */
  latestComfyUITag(): Promise<string | null>
  /** ComfyUI `requirements.txt` at `ref`. */
  requirementsAt(ref: string): Promise<string>
  listLabels(): string[]
  prsWaitingOn(label: string): PrRef[]
  openPrsAgainst(branch: string): PrRef[]
  commentBodies(prNumber: number): string[]
  postComment(prNumber: number, body: string): void
  deleteLabel(label: string): void
}

interface KeepFrom {
  keepFrom: ReleaseLine
  why: string
}

export async function resolveCloudKeepFrom(
  deps: RetireDeps
): Promise<KeepFrom> {
  const sha = (await deps.servedCloudSha())?.trim()
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(
      `cloud.comfy.org served no usable x-frontend-version (${sha})`
    )
  }
  const lines = deps
    .cloudBranchesContaining(sha)
    .map((b) => parseLine(b))
    .filter((l): l is ReleaseLine => l !== null)
  const keepFrom = oldestLine(lines)
  if (!keepFrom) throw new Error(`Served SHA ${sha} is on no cloud/* branch`)
  return {
    keepFrom,
    why: `cloud.comfy.org serves ${sha.slice(0, 8)} (cloud/${formatLine(keepFrom)})`
  }
}

export async function resolveCoreKeepFrom(deps: RetireDeps): Promise<KeepFrom> {
  const tag = await deps.latestComfyUITag()
  if (!tag) throw new Error('ComfyUI has no latest release')
  const pins = await Promise.all(
    ['master', tag].map(async (ref) => {
      const version = parsePinnedVersion(await deps.requirementsAt(ref))
      const line = version ? minorLineOf(version) : null
      if (!version || !line) {
        throw new Error(`No frontend pin in requirements.txt @ ${ref}`)
      }
      return { ref, version, line: parseLine(line)! }
    })
  )
  return {
    keepFrom: oldestLine(pins.map((p) => p.line))!,
    why: `ComfyUI pins ${pins.map((p) => `${p.version} @ ${p.ref}`).join(', ')}`
  }
}

export interface LabelRetirement {
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

/**
 * Comment, then delete. Once the label is gone, the comment is the only record
 * on these PRs that the backport was ever requested. A PR already commented on
 * for a label by an earlier run is skipped.
 */
function applyRetirements(
  deps: RetireDeps,
  retirements: LabelRetirement[],
  product: Product,
  keepFrom: string
): void {
  const pairs = retirements.flatMap(({ label, waiting }) =>
    waiting.map((pr) => ({ label, pr }))
  )
  for (const { pr, labels } of groupByPr(pairs)) {
    const toNote = labelsToNote(deps.commentBodies(pr.number), labels)
    if (toNote.length === 0) continue
    deps.postComment(pr.number, retirementComment(toNote, product, keepFrom))
  }
  for (const { label } of retirements) deps.deleteLabel(label)
}

export interface RetireResult {
  header: string
  lines: string[]
  retired: string[]
}

export async function runRetirement(
  {
    product,
    dryRun,
    maxPerRun = DEFAULT_MAX_PER_RUN
  }: { product: Product; dryRun: boolean; maxPerRun?: number },
  deps: RetireDeps
): Promise<RetireResult> {
  // Every signal is read and the plan is checked before anything is written,
  // so a failure in either changes nothing.
  const { keepFrom, why } =
    product === 'cloud'
      ? await resolveCloudKeepFrom(deps)
      : await resolveCoreKeepFrom(deps)
  const plan = planRetirement({
    labels: deps.listLabels(),
    product,
    keepFrom,
    maxPerRun
  })
  const keep = formatLine(keepFrom)

  const retirements = plan.retire.map((label) => ({
    label,
    waiting: deps.prsWaitingOn(label),
    open: deps.openPrsAgainst(label)
  }))
  if (!dryRun) applyRetirements(deps, retirements, product, keep)

  return {
    header: `*${product}*: ${why}. Keeping ${product}/${keep} and newer.`,
    lines: retirements.map((r) => reportLine(r, dryRun)),
    retired: plan.retire
  }
}

// ---------------------------------------------------------------------------
// Real I/O. Every GitHub call is `gh api` (REST): `gh pr edit` and friends
// need `read:org`, which the workflow token does not have.
// ---------------------------------------------------------------------------

const REPO = process.env.GITHUB_REPOSITORY ?? 'Comfy-Org/ComfyUI_frontend'
const COMFYUI_REPO = 'Comfy-Org/ComfyUI'

function run(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  }).trim()
}

function ghApi(...args: string[]): string {
  return run('gh', ['api', ...args])
}

async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`)
  return response
}

const PR_FIELDS = '{number, title, html_url}'

const realDeps: RetireDeps = {
  async servedCloudSha() {
    const response = await fetchOk('https://cloud.comfy.org/', {
      method: 'HEAD'
    })
    return response.headers.get('x-frontend-version')
  },
  cloudBranchesContaining(sha) {
    return run('git', [
      'for-each-ref',
      '--format=%(refname:lstrip=4)',
      '--contains',
      sha,
      'refs/remotes/origin/cloud/'
    ])
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)
  },
  async latestComfyUITag() {
    const raw = ghApi(
      `repos/${COMFYUI_REPO}/releases/latest`,
      '--jq',
      '.tag_name'
    )
    return raw || null
  },
  async requirementsAt(ref) {
    const url = `https://raw.githubusercontent.com/${COMFYUI_REPO}/${ref}/requirements.txt`
    return (await fetchOk(url)).text()
  },
  listLabels() {
    return ghApi(
      '--paginate',
      `repos/${REPO}/labels?per_page=100`,
      '--jq',
      '.[].name'
    )
      .split('\n')
      .filter(Boolean)
  },
  // Open only: a merged PR that kept `needs-backport` had a backport fail on
  // some line, and once that line is dead the leftover label is history, not a
  // task. Commenting on those would post dozens of comments per retired line.
  prsWaitingOn(label) {
    const q = `repo:${REPO} is:pr is:open label:needs-backport label:"${label}"`
    return JSON.parse(
      ghApi(
        '-X',
        'GET',
        'search/issues',
        '-f',
        `q=${q}`,
        '-f',
        'per_page=100',
        '--jq',
        `[.items[] | ${PR_FIELDS}]`
      )
    ) as PrRef[]
  },
  openPrsAgainst(branch) {
    return JSON.parse(
      ghApi(
        `repos/${REPO}/pulls?state=open&base=${encodeURIComponent(branch)}&per_page=100`,
        '--jq',
        `[.[] | ${PR_FIELDS}]`
      )
    ) as PrRef[]
  },
  commentBodies(prNumber) {
    // One JSON-encoded body per line: bodies are multi-line, and --slurp
    // cannot be combined with --jq.
    return ghApi(
      '--paginate',
      `repos/${REPO}/issues/${prNumber}/comments?per_page=100`,
      '--jq',
      '.[] | .body | @json'
    )
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string)
  },
  postComment(prNumber, body) {
    ghApi(
      '--silent',
      `repos/${REPO}/issues/${prNumber}/comments`,
      '-f',
      `body=${body}`
    )
  },
  deleteLabel(label) {
    ghApi(
      '--silent',
      '-X',
      'DELETE',
      `repos/${REPO}/labels/${labelPath(label)}`
    )
  }
}

function readArgs(): {
  product: Product
  dryRun: boolean
  maxPerRun: number
  report: string
} {
  const { values } = parseArgs({
    options: {
      product: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'max-per-run': { type: 'string', default: String(DEFAULT_MAX_PER_RUN) },
      report: { type: 'string', default: 'report.md' }
    }
  })
  const { product } = values
  if (product !== 'core' && product !== 'cloud') {
    throw new Error('--product must be core or cloud')
  }
  const maxPerRun = Number(values['max-per-run'])
  if (!Number.isInteger(maxPerRun) || maxPerRun < 0) {
    throw new Error('--max-per-run must be a non-negative integer')
  }
  return {
    product,
    dryRun: values['dry-run'],
    maxPerRun,
    report: values.report
  }
}

async function main(): Promise<void> {
  const { report, ...options } = readArgs()
  const { header, lines, retired } = await runRetirement(options, realDeps)

  console.error(header)
  for (const line of lines) console.error(line)
  if (lines.length === 0) console.error('Nothing to retire.')

  writeFileSync(report, lines.length > 0 ? [header, ...lines].join('\n') : '')
  if (process.env.GITHUB_OUTPUT && retired.length > 0) {
    appendFileSync(process.env.GITHUB_OUTPUT, `retired=${retired.join(' ')}\n`)
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
