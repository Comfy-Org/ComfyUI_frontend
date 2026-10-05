import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { mapConcurrent } from './router-model-batch'
import { publishedWorkflows, workflow_render } from './workflow-render'
import type { WorkflowCheckResult, WorkflowRunResult } from './workflow-sweep'
import {
  cloudErrorOf,
  delivered,
  failureReason,
  hasFunds,
  parseRepeats,
  publishedRepeats,
  retryServerError,
  runPassed,
  settledRunOutcome,
  sweepPassed,
  workflowChecks,
  workflowSweepMarkdown
} from './workflow-sweep'

const HELP = `Check every published Cloud workflow page, then optionally run its defaults.

pnpm --filter @comfyorg/website test:workflow-pages [options]

  --execute              Run each workflow's defaults on Cloud (paid; default: free checks only)
  --slug SLUG            Limit to one workflow page; repeat to select more
  --repeat SLUG=N        Run SLUG N times (default 1); repeat for more pages
  --concurrency N        Simultaneous live runs, 1–8 (default: 4)
  --site URL             Site hosting the pages (default: https://comfy.org)
  --output DIR           Write workflow-sweep.json and workflow-sweep.md there
  --help                 Show this help

--execute requires COMFY_API_KEY for a Cloud workspace with funds and
PUBLIC_WORKSHOP_CLOUD_ENV. Free checks fetch every page, graph file, sample and
example input. Live runs submit each page's own defaults, wait for Cloud, and
require every selected output to download. Failures record Cloud's node and
error message. The command exits non-zero when anything fails.
`

const { values } = parseArgs({
  options: {
    execute: { type: 'boolean', default: false },
    slug: { type: 'string', multiple: true },
    repeat: { type: 'string', multiple: true },
    concurrency: { type: 'string', default: '4' },
    site: { type: 'string', default: 'https://comfy.org' },
    output: { type: 'string' },
    help: { type: 'boolean', default: false }
  }
})

if (values.help) {
  process.stdout.write(HELP)
  process.exit(0)
}

const concurrency = Number(values.concurrency)
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
  throw new Error('--concurrency must be an integer from 1 to 8')

const published = publishedWorkflows()
const publishedSlugs = new Set(published.map((detail) => detail.slug))
const details = published.filter(
  (detail) => !values.slug || values.slug.includes(detail.slug)
)
for (const slug of values.slug ?? [])
  if (!publishedSlugs.has(slug))
    throw new Error(`Not a published workflow page: ${slug}`)

const { repeats, unpublished } = publishedRepeats(
  parseRepeats(values.repeat ?? []),
  publishedSlugs
)
for (const slug of unpublished)
  process.stderr.write(`Skipping --repeat for unpublished page: ${slug}\n`)

async function fetchStatus(url: string): Promise<number | 'error'> {
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-1023', 'User-Agent': 'comfy-workflow-sweep' },
      signal: AbortSignal.timeout(60_000)
    })
    await response.body?.cancel()
    return response.status
  } catch {
    return 'error'
  }
}

function probe(url: string): Promise<number | 'error'> {
  return retryServerError(() => fetchStatus(url))
}

async function runChecks(): Promise<WorkflowCheckResult[]> {
  const checks = details.flatMap((detail) =>
    workflowChecks(detail, values.site)
  )
  return mapConcurrent(checks, 12, async (check) => ({
    ...check,
    status: await probe(check.url)
  }))
}

async function cloudJob(runId: string, token: string): Promise<unknown> {
  const response = await fetch(
    `${WORKSHOP_CLOUD_BASE_URL}/api/jobs/${runId}?short_link=ephemeral_tool_chain`,
    { headers: { 'X-API-Key': token }, signal: AbortSignal.timeout(30_000) }
  )
  return response.ok ? response.json() : undefined
}

async function assertFunded(token: string) {
  const response = await fetch(
    `${WORKSHOP_CLOUD_BASE_URL}/api/billing/status`,
    {
      headers: { 'X-API-Key': token },
      signal: AbortSignal.timeout(30_000)
    }
  )
  const status: unknown = await response.json().catch(() => undefined)
  if (!response.ok || !hasFunds(status))
    throw new Error(
      'The COMFY_API_KEY workspace has no Cloud funds; live workflow runs would be refused.'
    )
}

async function deliveredOutputs(
  outputs: readonly { kind: string; url?: string }[]
) {
  return Promise.all(
    outputs.map(async (output) => ({
      kind: output.kind,
      status: output.url ? await probe(output.url) : ('error' as const)
    }))
  )
}

async function jobError(runId: string | undefined, token: string) {
  if (!runId) return undefined
  return cloudErrorOf(await cloudJob(runId, token).catch(() => undefined))
}

async function settledRun(
  slug: string,
  attempt: number,
  token: string,
  onAdmitted: (id: string) => void
): Promise<Omit<WorkflowRunResult, 'seconds'>> {
  const result = await workflow_render(
    slug,
    {},
    {
      token,
      signal: AbortSignal.timeout(40 * 60_000),
      onAdmitted: (run) => onAdmitted(run.id)
    }
  )
  const outputs = await deliveredOutputs(result.outputs)
  const runId = result.run.run.id
  const outcome = settledRunOutcome(
    result.run.run.state,
    result.run.outputs.length,
    outputs.filter(delivered).length
  )
  if (outcome.status === 'passed')
    return { slug, attempt, runId, outputs, status: 'passed' }
  return {
    slug,
    attempt,
    runId,
    outputs,
    ...outcome,
    cloudError: await jobError(runId, token)
  }
}

async function runOnce(
  slug: string,
  attempt: number,
  token: string
): Promise<WorkflowRunResult> {
  const started = Date.now()
  const seconds = () => Math.round((Date.now() - started) / 1000)
  let runId: string | undefined
  try {
    const result = await settledRun(slug, attempt, token, (id) => {
      runId = id
    })
    return { ...result, seconds: seconds() }
  } catch (error) {
    return {
      slug,
      attempt,
      status: 'failed',
      seconds: seconds(),
      reason: failureReason(error),
      outputs: [],
      runId,
      cloudError: await jobError(runId, token)
    }
  }
}

async function runLive(): Promise<WorkflowRunResult[]> {
  const token = process.env.COMFY_API_KEY
  if (!token) throw new Error('Set COMFY_API_KEY before using --execute')
  await assertFunded(token)
  const cases = details.flatMap((detail) =>
    Array.from({ length: repeats.get(detail.slug) ?? 1 }, (_, index) => ({
      slug: detail.slug,
      attempt: index + 1
    }))
  )
  return mapConcurrent(cases, concurrency, async ({ slug, attempt }) => {
    const result = await runOnce(slug, attempt, token)
    process.stdout.write(
      `${runPassed(result) ? 'passed' : 'FAILED'} ${slug}#${attempt} ${result.seconds}s ${result.reason ?? ''}\n`
    )
    return result
  })
}

const checks = await runChecks()
const runs = values.execute ? await runLive() : []
const markdown = workflowSweepMarkdown(checks, runs)
process.stdout.write(markdown)
if (values.output) {
  await mkdir(values.output, { recursive: true })
  await writeFile(
    join(values.output, 'workflow-sweep.json'),
    JSON.stringify({ version: 1, checks, runs }, null, 2) + '\n'
  )
  await writeFile(join(values.output, 'workflow-sweep.md'), markdown)
}
if (!sweepPassed(checks, runs)) process.exitCode = 1
