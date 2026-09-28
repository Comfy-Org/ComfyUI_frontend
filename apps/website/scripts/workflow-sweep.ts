import { z } from 'zod'

import type { WorkflowWorkshopModelDetail } from '../src/config/models-catalogue'

export interface WorkflowCheck {
  readonly slug: string
  readonly kind: 'page' | 'graph' | 'media'
  readonly url: string
}

export interface WorkflowCheckResult extends WorkflowCheck {
  readonly status: number | 'error'
  readonly detail?: string
}

export interface WorkflowCloudError {
  readonly nodeType?: string
  readonly message?: string
}

export interface WorkflowRunResult {
  readonly slug: string
  readonly attempt: number
  readonly status: 'passed' | 'failed'
  readonly seconds: number
  readonly runId?: string
  readonly reason?: string
  readonly cloudError?: WorkflowCloudError
  readonly outputs: readonly { kind: string; status: number | 'error' }[]
}

const HTTPS_URL = /https:\/\/[^\s"'\\]+/g

function absolute(site: string, url: string): string {
  return url.startsWith('/') ? new URL(url, site).href : url
}

export function workflowChecks(
  detail: WorkflowWorkshopModelDetail,
  site: string
): WorkflowCheck[] {
  const checks: WorkflowCheck[] = [
    { slug: detail.slug, kind: 'page', url: absolute(site, detail.href) }
  ]
  const template = detail.workflow.template
  for (const url of [template?.previewUrl, template?.downloadUrl])
    if (url)
      checks.push({
        slug: detail.slug,
        kind: 'graph',
        url: absolute(site, url)
      })
  const media = new Set(
    JSON.stringify([detail.thumbnail, detail.examples]).match(HTTPS_URL) ?? []
  )
  for (const url of [...media].sort())
    checks.push({ slug: detail.slug, kind: 'media', url })
  return checks
}

export function delivered(result: { status: number | 'error' }): boolean {
  return typeof result.status === 'number' && result.status < 400
}

export function checkPassed(result: WorkflowCheckResult): boolean {
  return delivered(result)
}

export function runPassed(result: WorkflowRunResult): boolean {
  return (
    result.status === 'passed' &&
    result.outputs.length > 0 &&
    result.outputs.every(delivered)
  )
}

export function sweepPassed(
  checks: readonly WorkflowCheckResult[],
  runs: readonly WorkflowRunResult[]
): boolean {
  return checks.every(checkPassed) && runs.every(runPassed)
}

export async function retryServerError(
  request: () => Promise<number | 'error'>
): Promise<number | 'error'> {
  const first = await request()
  return typeof first === 'number' && first < 500 ? first : request()
}

const fundedBillingStatus = z.object({ has_funds: z.literal(true) })

export function hasFunds(billingStatus: unknown): boolean {
  return fundedBillingStatus.safeParse(billingStatus).success
}

export function cloudErrorOf(job: unknown): WorkflowCloudError | undefined {
  if (typeof job !== 'object' || job === null) return undefined
  const error = (job as { execution_error?: unknown }).execution_error
  if (typeof error !== 'object' || error === null) return undefined
  const { node_type, exception_message } = error as {
    node_type?: unknown
    exception_message?: unknown
  }
  return {
    ...(typeof node_type === 'string' ? { nodeType: node_type } : {}),
    ...(typeof exception_message === 'string'
      ? { message: exception_message.trim().slice(0, 500) }
      : {})
  }
}

function cell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export function workflowSweepMarkdown(
  checks: readonly WorkflowCheckResult[],
  runs: readonly WorkflowRunResult[]
): string {
  const failedChecks = checks.filter((check) => !checkPassed(check))
  const lines = [
    '## Workflow pages',
    '',
    `Free checks: ${checks.length - failedChecks.length}/${checks.length} passed.`,
    ...failedChecks.map(
      (check) =>
        `- ${check.kind} ${check.slug}: ${check.status} ${check.url}${check.detail ? ` (${check.detail})` : ''}`
    )
  ]
  if (runs.length) {
    const passed = runs.filter(runPassed).length
    lines.push(
      '',
      `Live runs: ${passed}/${runs.length} passed.`,
      '',
      '| Workflow | Attempt | Result | Seconds | Cloud run | Failure |',
      '| --- | ---: | --- | ---: | --- | --- |',
      ...runs.map((run) => {
        const failure = runPassed(run)
          ? ''
          : [run.reason, run.cloudError?.nodeType, run.cloudError?.message]
              .filter(Boolean)
              .join(' · ')
        return `| ${run.slug} | ${run.attempt} | ${runPassed(run) ? 'passed' : 'failed'} | ${run.seconds} | ${run.runId ?? ''} | ${cell(failure)} |`
      })
    )
  }
  return lines.join('\n') + '\n'
}

export function parseRepeats(entries: readonly string[]): Map<string, number> {
  return new Map(
    entries.map((entry) => {
      const parts = entry.split('=')
      const [slug, count] = parts
      const n = Number(count)
      if (
        parts.length !== 2 ||
        !slug ||
        !Number.isInteger(n) ||
        n < 1 ||
        n > 10
      )
        throw new Error(`--repeat expects SLUG=N with N 1–10: ${entry}`)
      return [slug, n] as const
    })
  )
}

export function publishedRepeats(
  repeats: ReadonlyMap<string, number>,
  published: ReadonlySet<string>
): { repeats: Map<string, number>; unpublished: string[] } {
  const entries = [...repeats]
  return {
    repeats: new Map(entries.filter(([slug]) => published.has(slug))),
    unpublished: entries
      .filter(([slug]) => !published.has(slug))
      .map(([slug]) => slug)
  }
}

export function settledRunOutcome(
  state: string,
  selected: number,
  delivered: number
): { status: 'passed' } | { status: 'failed'; reason: string } {
  if (state !== 'succeeded')
    return { status: 'failed', reason: `Cloud run ${state}` }
  if (delivered === 0 || delivered < selected)
    return {
      status: 'failed',
      reason: `${selected - delivered || selected} of ${selected} outputs not delivered`
    }
  return { status: 'passed' }
}

export function failureReason(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : String(error).slice(0, 200)
}
