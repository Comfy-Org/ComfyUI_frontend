import { waitFor } from '../../../../config/workshop-router'
import type { ReshootJob, ReshootTransport } from './transport'
import { ReshootError } from './transport'

const DEFAULT_RETRY_MS = 10_000
const MAX_SUBMIT_ATTEMPTS = 60
const STARTING = new Set(['deployment_not_ready', 'deployment_unavailable'])
const BACK_OFF = new Set([
  ...STARTING,
  'queue_full',
  'rate_limited',
  'concurrent_run_limit'
])
const POLL_MS = 2_000
const QUEUED = new Set(['queued', 'pending', 'submitted'])
const FAILED = new Set([
  'failed',
  'error',
  'cancelled',
  'canceled',
  'lost',
  'expired',
  'non_retryable_error'
])

export type ReshootRunPhase = 'starting' | 'queued' | 'running'

const backOffFrom = (error: unknown) =>
  error instanceof ReshootError && BACK_OFF.has(error.code) ? error : undefined

function retryDelayMs(error: ReshootError): number {
  const seconds = error.retryAfterSeconds
  return seconds !== undefined && seconds > 0
    ? seconds * 1000
    : DEFAULT_RETRY_MS
}

/** Where a polled job stands: done, failed, or still waiting in a phase. */
export function jobPhase(
  status: string
): ReshootRunPhase | 'succeeded' | 'failed' {
  if (status === 'succeeded') return 'succeeded'
  if (FAILED.has(status)) return 'failed'
  return QUEUED.has(status) ? 'queued' : 'running'
}

/**
 * A cold deployment, a full queue or the previous job still finishing is a
 * wait, not a failure: back off as the server asks and try again.
 */
async function submitWhenReady(
  transport: ReshootTransport,
  workflow: object,
  onPhase: (phase: ReshootRunPhase) => void,
  signal: AbortSignal
): Promise<ReshootJob> {
  for (let attempt = 1; ; attempt++) {
    try {
      // A fresh key per attempt: a refused submission created no job.
      return await transport.submit(workflow, crypto.randomUUID(), signal)
    } catch (error) {
      const refusal = backOffFrom(error)
      if (!refusal || attempt >= MAX_SUBMIT_ATTEMPTS) throw error
      onPhase(STARTING.has(refusal.code) ? 'starting' : 'queued')
      await waitFor(retryDelayMs(refusal), signal)
    }
  }
}

async function pollUntilSucceeded(
  transport: ReshootTransport,
  submitted: ReshootJob,
  onPhase: (phase: ReshootRunPhase) => void,
  signal: AbortSignal
): Promise<ReshootJob> {
  let job = submitted
  for (let phase = jobPhase(job.status); phase !== 'succeeded';) {
    if (phase === 'failed') throw new ReshootError('job_failed')
    onPhase(phase)
    await waitFor(POLL_MS, signal)
    job = await transport.job(job.id, signal)
    phase = jobPhase(job.status)
  }
  return job
}

/**
 * Submits, then polls until the job succeeds. Outputs are only served once
 * it has, so nothing is downloaded before this returns. Stopping cancels it.
 */
export async function runJob(
  transport: ReshootTransport,
  workflow: object,
  onPhase: (phase: ReshootRunPhase) => void,
  signal: AbortSignal
): Promise<ReshootJob> {
  const job = await submitWhenReady(transport, workflow, onPhase, signal)
  try {
    return await pollUntilSucceeded(transport, job, onPhase, signal)
  } catch (error) {
    if (signal.aborted) void transport.cancel(job.id)
    throw error
  }
}

const nameOf = (output: { filename?: string; name?: string }) =>
  output.filename ?? output.name ?? ''

/** The first output whose file name contains `part`, as bytes. */
export async function downloadOutput(
  transport: ReshootTransport,
  job: ReshootJob,
  part: string,
  signal: AbortSignal
): Promise<Blob> {
  const output = job.outputs?.find((entry) => nameOf(entry).includes(part))
  if (!output) throw new ReshootError('missing_output', undefined, part)
  return transport.output(job, output, signal)
}
