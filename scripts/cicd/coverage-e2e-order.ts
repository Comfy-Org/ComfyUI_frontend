#!/usr/bin/env tsx
/**
 * Decides whether the latest E2E coverage can be reported under this commit.
 *
 * Wired into `coverage-slack-notify.yaml` as the `e2e-order` step, which gates
 * both the E2E row and the saved baseline on the `usable` output.
 */
import { appendFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import {
  COVERAGE_METADATA_FILE,
  readCoverageMetadata
} from '../coverage-metadata'
import { isMainModule } from '../isMainModule'
import { fetchGitHubJson, isRecord } from './github-rest'

const CURRENT_DIR = 'temp/e2e-coverage'
const BASELINE_DIR = 'temp/e2e-coverage-baseline'

/** `compareCommits` statuses, plus the verdict for a comparison that failed. */
export type CommitRelation =
  | 'ahead'
  | 'behind'
  | 'diverged'
  | 'identical'
  | 'unknown'

/** How `head` stands relative to `base`; `ahead` means `base` is its ancestor. */
export type Compare = (base: string, head: string) => Promise<CommitRelation>

export interface E2eCoverageShas {
  /** Commit the measurement ran on, or `null` when it recorded none. */
  current: string | null
  baseline: string | null
}

export interface Withheld {
  target: 'current' | 'baseline'
  reason: string
}

export interface E2eOrder {
  usable: boolean
  withheld: Withheld[]
}

const USABLE: E2eOrder = { usable: true, withheld: [] }

function withholding(target: Withheld['target'], reason: string): E2eOrder {
  return { usable: false, withheld: [{ target, reason }] }
}

/**
 * E2E has no per-commit artifact to pin — it is whichever run last finished on
 * main — so unlike unit it can be measured on a commit this one does not
 * contain. Publishing that under this PR's headline would credit it with
 * movement from a descendant.
 *
 * The baseline is withheld too, not just the comparison: E2E runs also finish
 * out of order, so the newest measurement can be older than the stored
 * baseline. Saving it would walk the baseline backwards and make the next
 * delta re-cover ground already reported.
 *
 * An artifact that never recorded its commit predates this check rather than
 * contradicting it; completeness already gates those.
 */
export async function orderE2eCoverage(
  { current, baseline }: E2eCoverageShas,
  headSha: string,
  compare: Compare
): Promise<E2eOrder> {
  // A failed comparison is an unavailable answer, not an answer about
  // ancestry: claiming the commit does not contain it would send whoever
  // reads the warning through the history for a problem that is in the API.
  if (current !== null && current !== headSha) {
    const toHead = await compare(current, headSha)
    if (toHead === 'unknown') {
      return withholding(
        'current',
        `E2E coverage at ${current} could not be ordered against this commit`
      )
    }
    if (toHead !== 'ahead') {
      return withholding(
        'current',
        `E2E coverage was measured on ${current}, which this commit does not contain`
      )
    }
  }

  if (baseline === null) return USABLE

  // An identified baseline must not be replaced by a measurement that cannot
  // be placed against it. A baseline with no sha is the opposite case and is
  // left replaceable, or a legacy one would block its own succession forever.
  if (current === null) {
    return withholding(
      'baseline',
      `E2E coverage names no commit to order against baseline ${baseline}`
    )
  }

  // Re-reporting the same measurement is the steady state between E2E runs,
  // not an anomaly: the delta is zero, and re-saving it leaves the baseline
  // exactly where it was.
  if (baseline === current) return USABLE

  const toCurrent = await compare(baseline, current)
  if (toCurrent === 'unknown') {
    return withholding(
      'baseline',
      `E2E baseline ${baseline} could not be ordered against ${current}`
    )
  }
  if (toCurrent !== 'ahead') {
    return withholding(
      'baseline',
      `E2E baseline ${baseline} is not behind ${current}`
    )
  }

  return USABLE
}

function sourceShaIn(dir: string): string | null {
  return (
    readCoverageMetadata(join(dir, COVERAGE_METADATA_FILE))?.sourceSha ?? null
  )
}

function isRelation(value: unknown): value is CommitRelation {
  return (
    value === 'ahead' ||
    value === 'behind' ||
    value === 'diverged' ||
    value === 'identical'
  )
}

function githubCompare(repository: string): Compare {
  return async (base, head) => {
    try {
      const comparison = await fetchGitHubJson(
        `/repos/${repository}/compare/${base}...${head}`
      )
      const status = isRecord(comparison) ? comparison.status : undefined
      return isRelation(status) ? status : 'unknown'
    } catch (error) {
      process.stdout.write(
        `::warning::Could not order ${base} against ${head}: ${error instanceof Error ? error.message : String(error)}\n`
      )
      return 'unknown'
    }
  }
}

function setUsable(usable: boolean) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) {
    process.stdout.write(`usable=${usable}\n`)
    return
  }
  appendFileSync(file, `usable=${usable}\n`)
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY
  const headSha = process.env.HEAD_SHA
  if (!repository || !headSha) {
    throw new Error('GITHUB_REPOSITORY and HEAD_SHA are required.')
  }

  const directories: Record<Withheld['target'], string> = {
    current: CURRENT_DIR,
    baseline: BASELINE_DIR
  }

  const { usable, withheld } = await orderE2eCoverage(
    { current: sourceShaIn(CURRENT_DIR), baseline: sourceShaIn(BASELINE_DIR) },
    headSha,
    githubCompare(repository)
  )

  for (const { target, reason } of withheld) {
    const directory = directories[target]
    process.stdout.write(
      `::warning::${reason}; withholding ${directory} from this report.\n`
    )
    rmSync(directory, { recursive: true, force: true })
  }

  setUsable(usable)
}

if (isMainModule(import.meta.url)) {
  await main()
}
