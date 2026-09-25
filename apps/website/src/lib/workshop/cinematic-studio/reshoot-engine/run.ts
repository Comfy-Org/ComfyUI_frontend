import { waitFor } from '../../../../config/workshop-router'
import type { ReshootJob, ReshootTransport } from './transport'
import { ReshootError } from './transport'

const NOT_READY_RETRY_MS = 10_000
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

/**
 * Submits, riding out a deployment still coming up (`deployment_not_ready`
 * is a wait, not a failure), then polls until the job succeeds. Outputs are
 * only served once it has, so nothing is downloaded before this returns.
 */
export async function runJob(
  transport: ReshootTransport,
  workflow: object,
  onPhase: (phase: ReshootRunPhase) => void,
  signal: AbortSignal
): Promise<ReshootJob> {
  let job: ReshootJob | undefined
  while (!job) {
    try {
      // A fresh key per attempt: a refused submission created no job.
      job = await transport.submit(workflow, crypto.randomUUID(), signal)
    } catch (error) {
      if (!(error instanceof ReshootError)) throw error
      if (error.code !== 'deployment_not_ready') throw error
      onPhase('starting')
      await waitFor(NOT_READY_RETRY_MS, signal)
    }
  }
  try {
    while (job.status !== 'succeeded') {
      if (FAILED.has(job.status)) throw new ReshootError('job_failed')
      onPhase(QUEUED.has(job.status) ? 'queued' : 'running')
      await waitFor(POLL_MS, signal)
      job = await transport.job(job.id, signal)
    }
    return job
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
