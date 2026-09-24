import type { HubKey } from '../../i18n/hub'

/** Where a run has got to, as the reader is told it. */
export type RunPhase =
  | 'idle'
  | 'uploading'
  | 'submitting'
  | 'reconnecting'
  | 'tracking'
  | 'finished'
  | 'cancelled'
  | 'error'

const UNDER_WAY: readonly RunPhase[] = [
  'uploading',
  'submitting',
  'tracking',
  'reconnecting'
]

/** Whether a run is still going, and so whether Run is out of reach. */
export const runUnderWay = (phase: RunPhase) => UNDER_WAY.includes(phase)

const BEFORE_THE_JOB: Partial<Record<RunPhase, HubKey>> = {
  uploading: 'workshop.v2.run.uploading',
  submitting: 'workshop.v2.run.sending',
  reconnecting: 'workshop.v2.run.reconnecting'
}

/**
 * The one line the wait is told in, the way a model's playground tells it.
 * Before the job exists this page is doing the work and says so; once it
 * exists, the run is either waiting its turn or making the thing. A workflow
 * that wakes a server of its own waits on that instead of on a queue, which
 * is a different wait and is named as one.
 */
export function runSaying(
  phase: RunPhase,
  queued: boolean,
  coldStart: boolean
): HubKey | undefined {
  if (phase !== 'tracking') return BEFORE_THE_JOB[phase]
  if (!queued) return 'workshop.v2.run.generating'
  return coldStart ? 'workshop.v2.run.waking' : 'workshop.v2.run.queued'
}

/** The aside a cold start earns, because its first run is the slow one. */
export function runHint(
  phase: RunPhase,
  queued: boolean,
  coldStart: boolean
): HubKey | undefined {
  return coldStart && queued && phase === 'tracking'
    ? 'workshop.v2.run.wakingHint'
    : undefined
}
