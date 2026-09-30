#!/usr/bin/env tsx
/**
 * Picks the commit whose `unit-coverage` artifact a merge is measured against.
 *
 * Wired into `coverage-slack-notify.yaml` as the `unit-baseline` step, which
 * passes the resolved run id straight to the artifact download.
 */
import { appendFileSync } from 'node:fs'

import { isMainModule } from '../isMainModule'
import { fetchGitHubJson, isRecord } from './github-rest'

/** Beyond this the walk gives up and unit is left out of that report. */
export const MAX_HOPS = 10

const UNIT_COVERAGE_ARTIFACT = 'unit-coverage'
const UNIT_WORKFLOW = 'ci-tests-unit.yaml'

export interface WorkflowRun {
  id: number
  /** `null` while the run is still in flight. */
  conclusion: string | null
}

/** The history the walk reads, injected so the policy above can be tested. */
export interface History {
  /** `null` at a root commit. */
  firstParentOf(sha: string): Promise<string | null>
  /** `CI: Tests Unit` push runs for `sha`, newest first. */
  unitRunsFor(sha: string): Promise<WorkflowRun[]>
  /** Names of the artifacts a run still holds unexpired. */
  liveArtifactsOf(runId: number): Promise<string[]>
}

export interface UnitBaseline {
  /** Commit to compare against, or `null` when none was measured. */
  ancestor: string | null
  runId: number | null
  /** The ancestor is further back than the direct parent. */
  spanned: boolean
  /** Oldest commit the walk rejected, so a give-up can say how far it got. */
  lastChecked?: string | null
}

/**
 * A cancelled run can still hold coverage, because its upload is an `always()`
 * step, and may have been killed partway through merging the shard reports.
 * Only a run that reached a verdict is trusted.
 */
async function measuredRunFor(
  history: History,
  sha: string
): Promise<number | null> {
  for (const run of await history.unitRunsFor(sha)) {
    if (run.conclusion !== 'success' && run.conclusion !== 'failure') continue
    const artifacts = await history.liveArtifactsOf(run.id)
    if (artifacts.includes(UNIT_COVERAGE_ARTIFACT)) return run.id
  }
  return null
}

/**
 * Walks first parents until one has coverage to compare against, rather than
 * pinning the direct parent: merge-queue batches land several commits per push
 * and only the batch head runs, a parent's own run can still be in flight, and
 * a run whose shards failed uploads nothing. `spanned` tells the report to
 * disclose how far back the comparison reaches.
 */
export async function resolveUnitBaseline(
  history: History,
  headSha: string
): Promise<UnitBaseline> {
  const directParent = await history.firstParentOf(headSha)
  let ancestor = directParent
  let lastChecked: string | null = null

  for (let hop = 0; ancestor !== null && hop < MAX_HOPS; hop++) {
    const runId = await measuredRunFor(history, ancestor)
    if (runId !== null) {
      return { ancestor, runId, spanned: ancestor !== directParent }
    }
    lastChecked = ancestor
    ancestor = await history.firstParentOf(ancestor)
  }

  return { ancestor: null, runId: null, spanned: false, lastChecked }
}

function firstParentOf(commit: unknown): string | null {
  if (!isRecord(commit) || !Array.isArray(commit.parents)) return null
  const parent: unknown = commit.parents[0]
  return isRecord(parent) && typeof parent.sha === 'string' ? parent.sha : null
}

function workflowRunsOf(page: unknown): WorkflowRun[] {
  if (!isRecord(page) || !Array.isArray(page.workflow_runs)) return []
  return page.workflow_runs.flatMap((run: unknown) =>
    isRecord(run) && typeof run.id === 'number'
      ? [
          {
            id: run.id,
            conclusion:
              typeof run.conclusion === 'string' ? run.conclusion : null
          }
        ]
      : []
  )
}

function liveArtifactNamesOf(page: unknown): string[] {
  if (!isRecord(page) || !Array.isArray(page.artifacts)) return []
  return page.artifacts.flatMap((artifact: unknown) =>
    isRecord(artifact) &&
    typeof artifact.name === 'string' &&
    artifact.expired !== true
      ? [artifact.name]
      : []
  )
}

function githubHistory(repository: string): History {
  return {
    async firstParentOf(sha) {
      return firstParentOf(
        await fetchGitHubJson(`/repos/${repository}/commits/${sha}`)
      )
    },
    async unitRunsFor(sha) {
      return workflowRunsOf(
        await fetchGitHubJson(
          `/repos/${repository}/actions/workflows/${UNIT_WORKFLOW}/runs` +
            `?branch=main&event=push&head_sha=${sha}&per_page=20`
        )
      )
    },
    async liveArtifactsOf(runId) {
      return liveArtifactNamesOf(
        await fetchGitHubJson(
          `/repos/${repository}/actions/runs/${runId}/artifacts` +
            `?name=${UNIT_COVERAGE_ARTIFACT}&per_page=100`
        )
      )
    }
  }
}

function setOutputs(baseline: UnitBaseline) {
  const lines = [
    `ancestor=${baseline.ancestor ?? ''}`,
    `run-id=${baseline.runId ?? ''}`,
    `spanned=${baseline.spanned}`
  ]
  const file = process.env.GITHUB_OUTPUT
  if (!file) {
    process.stdout.write(`${lines.join('\n')}\n`)
    return
  }
  appendFileSync(file, `${lines.join('\n')}\n`)
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY
  const headSha = process.env.HEAD_SHA
  if (!repository || !headSha) {
    throw new Error('GITHUB_REPOSITORY and HEAD_SHA are required.')
  }

  const baseline = await resolveUnitBaseline(githubHistory(repository), headSha)

  if (baseline.ancestor === null) {
    const reach = baseline.lastChecked
      ? `back as far as ${baseline.lastChecked}`
      : 'and it has no parent'
    process.stdout.write(
      `::warning::No measured ancestor within ${MAX_HOPS} commits of ${headSha} (${reach}); unit coverage has nothing to compare against, and movement since then goes unreported.\n`
    )
  } else if (baseline.spanned) {
    process.stdout.write(
      `Nearest measured ancestor is ${baseline.ancestor}, not the direct parent.\n`
    )
  }

  setOutputs(baseline)
}

if (isMainModule(import.meta.url)) {
  await main()
}
