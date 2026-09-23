import type { TranslationKey } from '../../i18n/translations'

/** Where a run has got to, as the reader is told it. */
export type RunPhase =
  | 'idle'
  | 'uploading'
  | 'submitting'
  | 'reconnecting'
  | 'tracking'
  | 'finished'
  | 'error'

const QUEUED: readonly TranslationKey[] = [
  'workshop.v2.run.queued',
  'workshop.v2.run.generating'
]

const COLD: readonly TranslationKey[] = [
  'workshop.v2.run.waking',
  'workshop.v2.run.loading',
  'workshop.v2.run.generating'
]

/**
 * The wait, as the steps it actually has. Shared Cloud is already awake, so
 * its wait is a queue and then the work. A workflow with a server of its own
 * wakes it and loads its models first, which is the long part, and a reader
 * who is told that reads a slow first run as the shape of the thing.
 */
export function runSteps(coldStart: boolean): readonly TranslationKey[] {
  return coldStart ? COLD : QUEUED
}

/** How far down those steps the run has got, or -1 before it starts. */
export function stepReached(
  phase: RunPhase,
  queued: boolean,
  steps: number
): number {
  if (phase === 'finished') return steps
  if (phase === 'uploading' || phase === 'submitting') return 0
  if (phase === 'tracking') return queued ? 0 : steps - 1
  return -1
}

const SAYING: Partial<Record<RunPhase, TranslationKey>> = {
  uploading: 'workshop.v2.run.uploading',
  submitting: 'workshop.v2.run.sending',
  reconnecting: 'workshop.v2.run.reconnecting'
}

/**
 * What to say beside the steps. Everything before the job exists is about
 * this page's own work, so it says that; once the job exists, the step it has
 * reached is the whole answer and repeating it would say nothing.
 */
export function runSaying(
  phase: RunPhase,
  step: TranslationKey | undefined
): TranslationKey | undefined {
  return phase === 'tracking' ? step : SAYING[phase]
}
