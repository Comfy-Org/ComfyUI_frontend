import type { ProgressStateWsMessage } from '@comfyorg/api-client/executionTypes'
import type { JobDetail } from '@comfyorg/api-client/jobTypes'

import { t } from '@/i18n'
import { api } from '@/scripts/api'

type CloudJobOutcome =
  | { ok: true; detail: JobDetail }
  | { ok: false; message: string }

interface CloudJobWatch {
  promptId: string
  signal: AbortSignal
  onProgress: (fraction: number) => void
  hasOutputs: (detail: JobDetail) => boolean
}

type Verdict =
  | { kind: 'waiting' }
  | { kind: 'done'; detail: JobDetail }
  | { kind: 'empty' }
  | { kind: 'failed'; message: string }

interface Alarm {
  ring(): void
  sleep(ms: number): Promise<void>
}

interface JobActivity {
  running: boolean
}

const FIRST_POLL_MS = 2000
const MAX_POLL_MS = 5000
const POLL_GROWTH = 1.5
const EMPTY_REFETCHES = 3
const EMPTY_REFETCH_MS = 1000
const DEADLINE_MS = 30 * 60 * 1000
const TERMINAL_EVENTS: readonly (
  | 'execution_success'
  | 'execution_error'
  | 'execution_interrupted'
)[] = ['execution_success', 'execution_error', 'execution_interrupted']

function failureMessage(detail: JobDetail): string {
  const error = detail.execution_error
  if (!error) return t('superComfy.app.runFailed')
  return error.node_type
    ? `${error.exception_message} (${error.node_type})`
    : error.exception_message
}

function judge(
  detail: JobDetail | undefined,
  hasOutputs: (detail: JobDetail) => boolean
): Verdict {
  switch (detail?.status) {
    case 'completed':
      return hasOutputs(detail) ? { kind: 'done', detail } : { kind: 'empty' }
    case 'failed':
      return { kind: 'failed', message: failureMessage(detail) }
    case 'cancelled':
      return { kind: 'failed', message: t('superComfy.app.cancelled') }
    default:
      return { kind: 'waiting' }
  }
}

function createAlarm(signal: AbortSignal): Alarm {
  let rang = false
  let wake: (() => void) | null = null
  return {
    ring() {
      if (wake) wake()
      else rang = true
    },
    sleep(ms) {
      if (rang || signal.aborted) {
        rang = false
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer)
          signal.removeEventListener('abort', finish)
          wake = null
          resolve()
        }
        const timer = setTimeout(finish, ms)
        signal.addEventListener('abort', finish, { once: true })
        wake = finish
      })
    }
  }
}

function listenToJob(
  watch: CloudJobWatch,
  alarm: Alarm,
  activity: JobActivity
): () => void {
  const onProgressState = (event: CustomEvent<ProgressStateWsMessage>) => {
    if (event.detail.prompt_id !== watch.promptId) return
    const nodes = Object.values(event.detail.nodes)
    if (nodes.length === 0) return
    activity.running = true
    const finished = nodes.filter((node) => node.state === 'finished').length
    watch.onProgress(finished / nodes.length)
  }
  const onTerminal = (event: CustomEvent<{ prompt_id: string }>) => {
    if (event.detail.prompt_id === watch.promptId) alarm.ring()
  }
  api.addEventListener('progress_state', onProgressState)
  for (const type of TERMINAL_EVENTS) api.addEventListener(type, onTerminal)
  return () => {
    api.removeEventListener('progress_state', onProgressState)
    for (const type of TERMINAL_EVENTS) {
      api.removeEventListener(type, onTerminal)
    }
  }
}

async function cancelJob(promptId: string, activity: JobActivity) {
  const cancelled = await api.cancelJob(promptId).then(
    () => true,
    () => false
  )
  if (!cancelled) await api.deleteItem('queue', promptId)
  if (activity.running) await api.interrupt(promptId)
}

function settledOutcome(
  verdict: Verdict,
  emptyRefetches: number
): CloudJobOutcome | null {
  switch (verdict.kind) {
    case 'done':
      return { ok: true, detail: verdict.detail }
    case 'failed':
      return { ok: false, message: verdict.message }
    case 'empty':
      return emptyRefetches === EMPTY_REFETCHES
        ? { ok: false, message: t('superComfy.node.noOutput') }
        : null
    case 'waiting':
      return null
  }
}

async function stopJob(
  watch: CloudJobWatch,
  activity: JobActivity
): Promise<CloudJobOutcome> {
  await cancelJob(watch.promptId, activity)
  return {
    ok: false,
    message: watch.signal.aborted
      ? t('superComfy.app.cancelled')
      : t('superComfy.app.timedOut')
  }
}

async function pollUntilSettled(
  watch: CloudJobWatch,
  alarm: Alarm,
  activity: JobActivity
): Promise<CloudJobOutcome> {
  const deadline = Date.now() + DEADLINE_MS
  let delay = FIRST_POLL_MS
  let emptyRefetches = 0
  while (!watch.signal.aborted && Date.now() < deadline) {
    const detail = await api.getJobDetail(watch.promptId, watch.signal)
    activity.running ||= detail?.status === 'in_progress'
    const verdict = judge(detail, watch.hasOutputs)
    const settled = settledOutcome(verdict, emptyRefetches)
    if (settled) return settled
    const empty = verdict.kind === 'empty'
    emptyRefetches += empty ? 1 : 0
    await alarm.sleep(empty ? EMPTY_REFETCH_MS : delay)
    delay = Math.min(delay * POLL_GROWTH, MAX_POLL_MS)
  }
  return stopJob(watch, activity)
}

/** Follows a queued prompt until it finishes, fails or is stopped. */
export async function watchCloudJob(
  watch: CloudJobWatch
): Promise<CloudJobOutcome> {
  const alarm = createAlarm(watch.signal)
  const activity: JobActivity = { running: false }
  const stopListening = listenToJob(watch, alarm, activity)
  try {
    return await pollUntilSettled(watch, alarm, activity)
  } finally {
    stopListening()
  }
}
