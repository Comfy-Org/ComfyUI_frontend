import { delay } from 'es-toolkit'
import { shallowRef } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import type { WorkspaceDeploymentCpuServer } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'

const CPU_SERVER_ASK_EVERY_MS = 5000
const CPU_SERVER_ASK_FOR_MS = 30 * 60_000
const CPU_SERVER_READ_ERROR_TYPE = 'cpu_server_step_read_failed'
const CPU_SERVER_UNKNOWN = 'cpu_server_unknown'

type CpuServerAnswer = WorkspaceDeploymentCpuServer['cpu_server'] | 'unknown'

export type CpuServerStep = 'creating' | 'building' | 'starting'

export interface CpuServerReading {
  answer: CpuServerAnswer
  error?: unknown
}

function readingOfFailure(error: unknown): CpuServerReading {
  if (!(error instanceof WorkspaceApiError)) return { answer: 'unknown', error }
  if (error.status === 404) return { answer: 'none' }
  if (error.status === 502 && error.code === CPU_SERVER_UNKNOWN)
    return { answer: 'unknown' }
  return { answer: 'unknown', error }
}

/** Asks which step the CPU server of the current workspace's deployment is on; an answer that outlived its workspace is `unknown`. */
export async function askCpuServer(): Promise<CpuServerReading> {
  const workspace = useTeamWorkspaceStore()
  const { workspaceId, workspaceTransitionGeneration: askedIn } = workspace
  if (!workspaceId) return { answer: 'none' }
  let reading: CpuServerReading
  try {
    const { cpu_server } =
      await workspaceApi.getDeploymentCpuServer(workspaceId)
    reading = { answer: cpu_server }
  } catch (error) {
    reading = readingOfFailure(error)
  }
  return workspace.workspaceTransitionGeneration === askedIn
    ? reading
    : { answer: 'unknown' }
}

/** Whether the CPU server does not exist yet, so the routes its packs serve fail until it does. */
export function isBeingSetUp(reading: CpuServerReading | undefined): boolean {
  return reading?.answer === 'creating' || reading?.answer === 'building'
}

function stepAfter(
  step: CpuServerStep | undefined,
  answer: CpuServerAnswer
): CpuServerStep | undefined {
  switch (answer) {
    case 'creating':
    case 'building':
      return answer
    case 'created':
      return 'starting'
    case 'none':
      return undefined
    case 'unknown':
      return step
  }
}

function stepRead(
  step: CpuServerStep | undefined,
  answer: CpuServerAnswer,
  onUnreadable: () => void
): CpuServerStep | undefined {
  if (answer === 'unknown' && step !== undefined) onUnreadable()
  return stepAfter(step, answer)
}

async function waitUnlessStopped(
  ms: number,
  signal: AbortSignal
): Promise<boolean> {
  try {
    await delay(ms, { signal })
    return true
  } catch (error) {
    if (signal.aborted) return false
    throw error
  }
}

function reportReadFailure(error: unknown) {
  reportError(error, {
    errorType: CPU_SERVER_READ_ERROR_TYPE,
    surface: 'platform',
    level: 'warning'
  })
}

function unlessStopped<T>(
  work: Promise<T>,
  signal: AbortSignal,
  stopAt: number
): Promise<T | undefined> {
  if (signal.aborted || Date.now() >= stopAt) {
    work.catch(() => {})
    return Promise.resolve(undefined)
  }
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(stop, stopAt - Date.now())
    signal.addEventListener('abort', stop, { once: true })
    work.then(
      (value) => {
        release()
        resolve(value)
      },
      (error: unknown) => {
        release()
        reject(error)
      }
    )

    function stop() {
      release()
      resolve(undefined)
    }

    function release() {
      clearTimeout(deadline)
      signal.removeEventListener('abort', stop)
    }
  })
}

async function askUntilSettled(
  firstReading: Promise<CpuServerReading>,
  signal: AbortSignal,
  step: { value: CpuServerStep | undefined },
  onUnreadable: () => void
) {
  const stopAt = Date.now() + CPU_SERVER_ASK_FOR_MS
  let asking = firstReading
  let failureReported = false
  for (;;) {
    const reading = await unlessStopped(asking, signal, stopAt)
    if (!reading) break
    if (!failureReported && reading.error !== undefined) {
      reportReadFailure(reading.error)
      failureReported = true
    }
    step.value = stepRead(step.value, reading.answer, onUnreadable)
    if (reading.answer === 'created' || reading.answer === 'none') return
    if (Date.now() + CPU_SERVER_ASK_EVERY_MS >= stopAt) break
    if (!(await waitUnlessStopped(CPU_SERVER_ASK_EVERY_MS, signal))) break
    asking = askCpuServer()
  }
  step.value = undefined
}

export interface CpuServerWatch {
  step: () => CpuServerStep | undefined
  ready: Promise<void>
}

/** Follows the CPU server's step from `firstReading`, asking every five seconds until it exists or will not come, for at most half an hour or until `signal` aborts; `ready` settles then, or once a step it named can no longer be read. */
export function watchCpuServer(
  firstReading: Promise<CpuServerReading>,
  signal: AbortSignal
): CpuServerWatch {
  const step = shallowRef<CpuServerStep | undefined>()
  const ready = new Promise<void>((resolve, reject) => {
    void askUntilSettled(firstReading, signal, step, resolve).then(
      resolve,
      reject
    )
  })
  return { step: () => step.value, ready }
}
