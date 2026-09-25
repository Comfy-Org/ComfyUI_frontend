#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { z } from 'zod'

const OWNER = 'Comfy-Org'
const REPO = 'ComfyUI_frontend'
const DEFAULT_CACHE = '/tmp/comfyui-frontend-ci-runtime'
const DEFAULT_OUTPUT = '.amp/in/artifacts/ci-runtime-analysis.json'

const zCommit = z.object({ oid: z.string(), committedDate: z.string() })
const zPr = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  updatedAt: z.string(),
  commits: z.object({ nodes: z.array(z.object({ commit: zCommit })) })
})
const zGraphql = z.object({
  data: z.object({
    repository: z.object({
      pullRequests: z.object({ nodes: z.array(zPr) })
    })
  })
})
const zRun = z.object({
  id: z.number(),
  workflow_id: z.number(),
  name: z.string(),
  event: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  head_sha: z.string(),
  run_attempt: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string()
})
const zJob = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  html_url: z.string(),
  labels: z.array(z.string()).default([])
})
const zRuns = z.object({
  total_count: z.number(),
  workflow_runs: z.array(zRun)
})
const zJobs = z.object({ total_count: z.number(), jobs: z.array(zJob) })

type Pr = z.infer<typeof zPr>
type Run = z.infer<typeof zRun>
type Job = z.infer<typeof zJob>
type Category =
  | 'lint'
  | 'typecheck'
  | 'typecheck-aux'
  | 'repo-checks'
  | 'fallow'
  | 'unit'
  | 'e2e-build'
  | 'e2e-test'
  | 'custom-nodes'
  | 'website'
  | 'storybook'
  | 'billing'

const REQUIRED = [
  'CI: Lint Format',
  'CI: Fallow',
  'CI: Tests Unit',
  'CI: Tests E2E',
  'CI: Custom Nodes Ecosystem Matrix'
] as const
const OPTIONAL_PREFIXES = [
  'CI: Website ',
  'CI: Tests Storybook',
  'CI: Billing '
]

function ownsWorkflow(name: string) {
  return (
    REQUIRED.some((required) => required === name) ||
    OPTIONAL_PREFIXES.some((prefix) => name.startsWith(prefix))
  )
}

export function classify(
  workflow: string,
  job: string
): {
  category: Category
  gate: boolean
  expensive: boolean
} | null {
  const rules: [RegExp, RegExp, Category][] = [
    [/^CI: Lint Format$/, /^lint( \(|$)/, 'lint'],
    [/^CI: Lint Format$/, /^typecheck( \(|$)/, 'typecheck'],
    [/^CI: Lint Format$/, /^typecheck-aux( \(|$)/, 'typecheck-aux'],
    [/^CI: Lint Format$/, /^repo-checks( \(|$)/, 'repo-checks'],
    [/^CI: Fallow$/, /^fallow( \(|$)/, 'fallow'],
    [/^CI: Tests Unit$/, /^test( \(|$)/, 'unit'],
    [/^CI: Tests E2E$/, /^setup$/, 'e2e-build'],
    [
      /^CI: Tests E2E$/,
      /^(playwright-tests(-chromium-sharded)?|playwright-video-new-tests)( \(|$)/,
      'e2e-test'
    ],
    [
      /^CI: Custom Nodes Ecosystem Matrix$/,
      /^(ecosystem-matrix|matrix-detection-proof)( \(|$)/,
      'custom-nodes'
    ],
    [/^CI: Website /, /./, 'website'],
    [/^CI: Tests Storybook$/, /./, 'storybook'],
    [/^CI: Billing /, /./, 'billing']
  ]
  const match = rules.find(
    ([owner, worker]) => owner.test(workflow) && worker.test(job)
  )
  if (!match) return null
  const category = match[2]
  const gate = [
    'lint',
    'typecheck',
    'typecheck-aux',
    'repo-checks',
    'fallow',
    'e2e-build'
  ].includes(category)
  return { category, gate, expensive: !gate }
}

interface Sample {
  pr: number
  prUrl: string
  sha: string
  committedAt: string
  workflow: string
  workflowId: number
  runId: number
  runAttempt: number
  runUrl: string
  runCreatedAt: string
  runCompletedAt: string
  job: string
  jobUrl: string
  category: Category
  gate: boolean
  expensive: boolean
  conclusion: string | null
  elapsedMinutes: number
  labels: string[]
}

interface Options {
  cohort: number
  commits: number
  cache: string
  output: string
  refresh: boolean
}

function options(args: string[]): Options {
  const get = (flag: string, fallback: string) => {
    const index = args.indexOf(flag)
    return index < 0 ? fallback : (args.at(index + 1) ?? fallback)
  }
  const cohort = Number(get('--cohort', '25'))
  const commits = Number(get('--commits', '5'))
  if (!Number.isInteger(cohort) || cohort < 1 || cohort > 50)
    throw new Error('--cohort must be 1..50')
  if (!Number.isInteger(commits) || commits < 1 || commits > 20)
    throw new Error('--commits must be 1..20')
  return {
    cohort,
    commits,
    cache: get('--cache', DEFAULT_CACHE),
    output: get('--output', DEFAULT_OUTPUT),
    refresh: args.includes('--refresh')
  }
}

async function cached(
  path: string,
  refresh: boolean,
  request: () => Promise<unknown>
) {
  if (!refresh && existsSync(path))
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  const value = await request()
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
  return value
}

async function api(
  token: string,
  url: string,
  init: Pick<RequestInit, 'method' | 'body'> = {}
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${url}`)
  return response.json() as Promise<unknown>
}

async function prs(token: string, o: Options): Promise<Pr[]> {
  const query = `query($prs:Int!,$commits:Int!){repository(owner:"${OWNER}",name:"${REPO}"){pullRequests(first:$prs,orderBy:{field:UPDATED_AT,direction:DESC},states:[OPEN,MERGED,CLOSED]){nodes{number title url updatedAt commits(last:$commits){nodes{commit{oid committedDate}}}}}}}`
  const raw = await cached(
    join(o.cache, `prs-${o.cohort}-commits-${o.commits}.json`),
    o.refresh,
    () =>
      api(token, 'https://api.github.com/graphql', {
        method: 'POST',
        body: JSON.stringify({
          query,
          variables: { prs: o.cohort, commits: o.commits }
        })
      })
  )
  return zGraphql.parse(raw).data.repository.pullRequests.nodes
}

async function runs(token: string, sha: string, o: Options): Promise<Run[]> {
  const result: Run[] = []
  for (let page = 1; ; page++) {
    const raw = zRuns.parse(
      await cached(join(o.cache, `runs-${sha}-${page}.json`), o.refresh, () =>
        api(
          token,
          `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?head_sha=${sha}&event=pull_request&per_page=100&page=${page}`
        )
      )
    )
    result.push(...raw.workflow_runs)
    if (result.length >= raw.total_count) return result
    if (raw.workflow_runs.length === 0)
      throw new Error(`Run pagination stalled for ${sha}`)
  }
}

async function jobs(token: string, run: Run, o: Options): Promise<Job[]> {
  const result: Job[] = []
  for (let page = 1; ; page++) {
    const raw = zJobs.parse(
      await cached(
        join(o.cache, `jobs-${run.id}-${run.run_attempt}-${page}.json`),
        o.refresh,
        () =>
          api(
            token,
            `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`
          )
      )
    )
    result.push(...raw.jobs)
    if (result.length >= raw.total_count) return result
    if (raw.jobs.length === 0)
      throw new Error(`Job pagination stalled for run ${run.id}`)
  }
}

export function latestRuns(input: Run[], sha: string): Run[] {
  const selected = new Map<number, Run>()
  for (const run of input) {
    if (run.head_sha !== sha || run.event !== 'pull_request') continue
    const old = selected.get(run.workflow_id)
    if (
      !old ||
      run.id > old.id ||
      (run.id === old.id && run.run_attempt > old.run_attempt)
    )
      selected.set(run.workflow_id, run)
  }
  return [...selected.values()]
}

export function elapsedMinutes(job: Job): number | null {
  if (job.conclusion === 'skipped' || !job.started_at || !job.completed_at)
    return null
  const elapsed =
    (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 60_000
  return elapsed < 0 ? null : elapsed
}

async function measureRun(
  token: string,
  run: Run,
  source: Pick<Sample, 'pr' | 'prUrl' | 'sha' | 'committedAt'>,
  o: Options
): Promise<Sample[]> {
  const runJobs = await jobs(token, run, o)
  return runJobs.flatMap((job) => {
    const owned = classify(run.name, job.name)
    const elapsed = elapsedMinutes(job)
    if (!owned || elapsed === null) return []
    return [
      {
        ...source,
        workflow: run.name,
        workflowId: run.workflow_id,
        runId: run.id,
        runAttempt: run.run_attempt,
        runUrl: run.html_url,
        runCreatedAt: run.created_at,
        runCompletedAt: run.updated_at,
        job: job.name,
        jobUrl: job.html_url,
        ...owned,
        conclusion: job.conclusion,
        elapsedMinutes: elapsed,
        labels: job.labels
      }
    ]
  })
}

const percentile = (values: number[], p: number) =>
  values.length
    ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]
    : null
const round = (n: number | null) =>
  n === null ? null : Math.round(n * 100) / 100

export function analyze(
  samples: Sample[],
  sources: { pr: number; sha: string }[]
) {
  const grouped = new Map<string, Sample[]>()
  for (const sample of samples) {
    const key = `${sample.sha}:${sample.runId}`
    grouped.set(key, [...(grouped.get(key) ?? []), sample])
  }
  const runSamples = [...grouped.values()].map((items) => ({
    workflow: items[0].workflow,
    sha: items[0].sha,
    pr: items[0].pr,
    wallMinutes:
      (Date.parse(items[0].runCompletedAt) -
        Date.parse(items[0].runCreatedAt)) /
      60_000,
    runnerMinutes: items.reduce((sum, x) => sum + x.elapsedMinutes, 0)
  }))
  const workflows = [...new Set(runSamples.map((x) => x.workflow))].map(
    (workflow) => {
      const values = runSamples.filter((x) => x.workflow === workflow)
      return {
        workflow,
        runs: values.length,
        p50WallMinutes: round(
          percentile(
            values.map((x) => x.wallMinutes),
            0.5
          )
        ),
        p90WallMinutes: round(
          percentile(
            values.map((x) => x.wallMinutes),
            0.9
          )
        ),
        p50RunnerMinutes: round(
          percentile(
            values.map((x) => x.runnerMinutes),
            0.5
          )
        ),
        p90RunnerMinutes: round(
          percentile(
            values.map((x) => x.runnerMinutes),
            0.9
          )
        )
      }
    }
  )
  const failed = new Set(
    samples
      .filter((x) => x.gate && x.conclusion === 'failure')
      .map((x) => x.sha)
  )
  const waste = samples.filter(
    (x) =>
      ['unit', 'e2e-test', 'custom-nodes'].includes(x.category) &&
      failed.has(x.sha)
  )
  const categories = [...new Set(samples.map((x) => x.category))].map(
    (category) => {
      const jobs = samples.filter((x) => x.category === category)
      const minutes = jobs.map((x) => x.elapsedMinutes)
      return {
        category,
        jobs: jobs.length,
        p50JobMinutes: round(percentile(minutes, 0.5)),
        p90JobMinutes: round(percentile(minutes, 0.9)),
        runnerMinutes: round(minutes.reduce((a, b) => a + b, 0))
      }
    }
  )
  return {
    workflows,
    categories,
    gateFailureImpact: {
      shas: failed.size,
      runnerMinutes: round(waste.reduce((s, x) => s + x.elapsedMinutes, 0)),
      jobs: waste.length
    },
    sourceShas: sources.length,
    measuredShas: new Set(samples.map((x) => x.sha)).size
  }
}

async function main() {
  const o = options(process.argv.slice(2))
  mkdirSync(o.cache, { recursive: true })
  mkdirSync(dirname(o.output), { recursive: true })
  const token =
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()
  const pullRequests = await prs(token, o)
  const commits = pullRequests.flatMap((pr) =>
    pr.commits.nodes.map(({ commit }) => ({
      pr: pr.number,
      prUrl: pr.url,
      sha: commit.oid,
      committedAt: commit.committedDate
    }))
  )
  const sources = [
    ...new Map(commits.map((source) => [source.sha, source])).values()
  ]
  const samples: Sample[] = []
  const coverage: object[] = []
  for (const source of sources) {
    const selected = latestRuns(await runs(token, source.sha, o), source.sha)
    const byName = new Map(selected.map((run) => [run.name, run]))
    coverage.push({
      ...source,
      workflows: REQUIRED.map((workflow) => ({
        workflow,
        status: byName.get(workflow)?.status ?? 'missing',
        conclusion: byName.get(workflow)?.conclusion ?? null
      }))
    })
    for (const run of selected) {
      if (run.status !== 'completed' || !ownsWorkflow(run.name)) continue
      samples.push(...(await measureRun(token, run, source, o)))
    }
  }
  const result = {
    generatedAt: new Date().toISOString(),
    repository: `${OWNER}/${REPO}`,
    cohort: {
      rule: `${o.cohort} most recently updated PRs; up to ${o.commits} latest commits each, deduplicated by SHA`,
      pullRequests
    },
    selection:
      'pull_request event only; newest run ID per workflow ID, then latest attempt',
    limits: [
      'GitHub timestamps measure elapsed runner time, not billed minutes',
      'Skipped jobs have no runner time; cancelled jobs count when timestamps exist',
      'Workflow wall time is updated_at minus created_at, including queue/dependency/report time; only completed runs with measured owned jobs are summarized',
      'Failure impact includes only core unit, E2E tests and ecosystem matrix jobs on the same source SHA; it is a counterfactual upper bound, not measured savings'
    ],
    summary: analyze(samples, sources),
    coverage,
    samples
  }
  writeFileSync(o.output, `${JSON.stringify(result, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
