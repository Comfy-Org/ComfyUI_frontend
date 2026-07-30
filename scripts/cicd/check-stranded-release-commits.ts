#!/usr/bin/env tsx
/**
 * Fails when a release line has fix commits that never reached users.
 *
 * `v1.47.10` was tagged 19h before the dropdown-stacking fix was backported onto
 * `core/1.47`. The backport merged, everyone treated it as done, and ComfyUI
 * 0.29.0 then pinned the older tag — so the fix sat on the branch for a week
 * while five separate users reported the bug it had already fixed. Merged onto a
 * release branch is not the same as shipped, and nothing asserted the difference.
 *
 * Only lines that users actually consume are checked: the minor ComfyUI pins and
 * the newest minor published to PyPI. Every other release branch has stranded
 * commits by design (dead lines, unreleased work) and would be pure noise.
 */
import { execFileSync } from 'child_process'
import { pathToFileURL } from 'url'

export interface Commit {
  sha: string
  subject: string
}

export type FindingKind =
  | 'stranded-commits'
  | 'published-version-lag'
  | 'published-version-missing'
  | 'pin-lag'

export interface Finding {
  kind: FindingKind
  branch: string
  severity: 'failure' | 'notice'
  message: string
  strandedFixCount: number
}

export interface LineInput {
  branch: string
  latestTag: string
  publishedVersion: string | null
  commits: Commit[]
}

// Conventional `fix:` / `fix(scope):`, plus a bare `Fix ...` / `Fixes ...` lead —
// #14116 stranded as "Fix migration of ..." and a colon-only pattern misses it.
const FIX_SUBJECT = /\bfix(\([^)]*\))?!?:|(?:^|\]\s*)fix(?:es|ed)?\s+\S/i

/** `1.47.10` → `1.47`. Null unless the input is a full X.Y.Z. */
export function minorLineOf(version: string): string | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim())
  return match ? `${match[1]}.${match[2]}` : null
}

export function releaseBranchFor(minorLine: string): string {
  return `core/${minorLine}`
}

export function classifyCommits(commits: Commit[]): {
  fixes: Commit[]
  others: Commit[]
} {
  return {
    fixes: commits.filter((c) => FIX_SUBJECT.test(c.subject)),
    others: commits.filter((c) => !FIX_SUBJECT.test(c.subject))
  }
}

export function evaluateLine(input: LineInput): {
  findings: Finding[]
  failed: boolean
} {
  const { branch, latestTag, publishedVersion, commits } = input
  const findings: Finding[] = []
  const { fixes } = classifyCommits(commits)

  if (commits.length > 0) {
    findings.push({
      kind: 'stranded-commits',
      branch,
      severity: fixes.length > 0 ? 'failure' : 'notice',
      strandedFixCount: fixes.length,
      message:
        fixes.length > 0
          ? `${fixes.length} fix commit(s) sit past ${latestTag} on ${branch} and have not shipped:\n` +
            fixes
              .map((c) => `    ${c.sha.slice(0, 10)} ${c.subject}`)
              .join('\n')
          : `${commits.length} non-fix commit(s) sit past ${latestTag} on ${branch}.`
    })
  }

  if (publishedVersion === null) {
    findings.push({
      kind: 'published-version-missing',
      branch,
      severity: 'failure',
      strandedFixCount: 0,
      message: `No published version found for ${branch}; cannot prove ${latestTag} reached users.`
    })
  } else if (publishedVersion !== latestTag.replace(/^v/, '')) {
    findings.push({
      kind: 'published-version-lag',
      branch,
      severity: 'failure',
      strandedFixCount: 0,
      message: `${branch} is tagged ${latestTag} but the published version is ${publishedVersion}.`
    })
  }

  return {
    findings,
    failed: findings.some((f) => f.severity === 'failure')
  }
}

// execFileSync, never execSync: git ref names legitimately permit `;`, `$()`,
// backticks and `|`, so a tag name reaching a shell is arbitrary code execution.
/**
 * A published fix that ComfyUI does not pin has still reached nobody. Only
 * same-line lag is a defect: stable intentionally trails the newest minor.
 */
export function evaluatePin({
  pinned,
  newestOnPinnedLine
}: {
  pinned: string
  newestOnPinnedLine: string
}): Finding | null {
  if (pinned === newestOnPinnedLine) return null
  return {
    kind: 'pin-lag',
    branch: releaseBranchFor(minorLineOf(pinned) ?? pinned),
    severity: 'failure',
    strandedFixCount: 0,
    message: `ComfyUI pins ${pinned} but ${newestOnPinnedLine} is published on that line — stable users do not have it yet.`
  }
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf-8' }).trim()
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`)
  return response.text()
}

export function parsePinnedVersion(requirements: string): string | null {
  const match = /^comfyui-frontend-package[=><]+(\d+\.\d+\.\d+)/m.exec(
    requirements
  )
  return match ? match[1] : null
}

/** Newest X.Y.Z on PyPI, ignoring pre-release formats. */
export function newestStableVersion(versions: string[]): string | null {
  const stable = versions
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
    .sort((a, b) => {
      const [aMaj, aMin, aPatch] = a.split('.').map(Number)
      const [bMaj, bMin, bPatch] = b.split('.').map(Number)
      return aMaj - bMaj || aMin - bMin || aPatch - bPatch
    })
  return stable.at(-1) ?? null
}

function latestTagOn(branch: string): string | null {
  try {
    return git('describe', '--tags', '--abbrev=0', `origin/${branch}`)
  } catch {
    return null
  }
}

function commitsPastTag(tag: string, branch: string): Commit[] {
  const raw = git('log', `${tag}..origin/${branch}`, '--format=%H%x1f%s')
  if (!raw) return []
  return raw.split('\n').map((line) => {
    const [sha, subject] = line.split('\x1f')
    return { sha, subject }
  })
}

async function main(): Promise<void> {
  const [requirements, pypi] = await Promise.all([
    fetchText(
      'https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/requirements.txt'
    ),
    fetchText('https://pypi.org/pypi/comfyui-frontend-package/json').then(
      (t) => JSON.parse(t) as { releases: Record<string, unknown> }
    )
  ])

  const pinned = parsePinnedVersion(requirements)
  const published = newestStableVersion(Object.keys(pypi.releases))

  if (!pinned) throw new Error('Could not read ComfyUI requirements.txt pin')
  if (!published) throw new Error('Could not read any stable PyPI version')

  const linesToCheck = [
    ...new Set([minorLineOf(pinned), minorLineOf(published)])
  ]
    .filter((line): line is string => line !== null)
    .map(releaseBranchFor)

  console.error(`ComfyUI pin: ${pinned}`)
  console.error(`PyPI latest: ${published}`)
  console.error(`Checking: ${linesToCheck.join(', ')}\n`)

  const allFindings: Finding[] = []

  for (const branch of linesToCheck) {
    git('fetch', 'origin', `${branch}:refs/remotes/origin/${branch}`, '--tags')
    const latestTag = latestTagOn(branch)
    if (!latestTag) {
      console.error(`${branch}: no tag found, skipping`)
      continue
    }

    const minor = branch.replace('core/', '')
    const { findings } = evaluateLine({
      branch,
      latestTag,
      publishedVersion: minorLineOf(published) === minor ? published : pinned,
      commits: commitsPastTag(latestTag, branch)
    })
    allFindings.push(...findings)
  }

  const pinnedLine = minorLineOf(pinned)
  const newestOnPinnedLine = newestStableVersion(
    Object.keys(pypi.releases).filter((v) => minorLineOf(v) === pinnedLine)
  )
  if (newestOnPinnedLine) {
    const pinFinding = evaluatePin({ pinned, newestOnPinnedLine })
    if (pinFinding) allFindings.push(pinFinding)
  }

  if (allFindings.length === 0) {
    console.error('All consumed release lines are fully shipped.')
    return
  }

  for (const finding of allFindings) {
    const label = finding.severity === 'failure' ? 'FAIL' : 'note'
    console.error(`[${label}] ${finding.message}`)
  }

  if (allFindings.some((f) => f.severity === 'failure')) {
    process.exitCode = 1
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
