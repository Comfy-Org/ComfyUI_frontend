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

type CpuServerAnswer = WorkspaceDeploymentCpuServer['cpu_server'] | 'unknown'

type CpuServerStep = 'creating' | 'building' | 'starting'

export interface CpuServerReading {
  answer: CpuServerAnswer
  error?: unknown
}

function readingOfFailure(error: unknown): CpuServerReading {
  if (!(error instanceof WorkspaceApiError)) return { answer: 'unknown', error }
  if (error.status === 404) return { answer: 'none' }
  if (error.status === 502) return { answer: 'unknown' }
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

async function askUntilSettled(
  firstReading: Promise<CpuServerReading>,
  signal: AbortSignal,
  step: { value: CpuServerStep | undefined }
) {
  const stopAt = Date.now() + CPU_SERVER_ASK_FOR_MS
  let reading = await firstReading
  let failureReported = false
  while (!signal.aborted) {
    if (!failureReported && reading.error !== undefined) {
      reportReadFailure(reading.error)
      failureReported = true
    }
    step.value = stepAfter(step.value, reading.answer)
    if (reading.answer === 'created' || reading.answer === 'none') return
    if (Date.now() + CPU_SERVER_ASK_EVERY_MS > stopAt) break
    if (!(await waitUnlessStopped(CPU_SERVER_ASK_EVERY_MS, signal))) return
    reading = await askCpuServer()
  }
  step.value = undefined
}

export interface CpuServerWatch {
  step: () => CpuServerStep | undefined
  ready: Promise<void>
}

/** Follows the CPU server's step from `firstReading`, asking every five seconds until it exists or will not come, for at most half an hour or until `signal` aborts. */
export function watchCpuServer(
  firstReading: Promise<CpuServerReading>,
  signal: AbortSignal
): CpuServerWatch {
  const step = shallowRef<CpuServerStep | undefined>()
  const ready = askUntilSettled(firstReading, signal, step)
  return { step: () => step.value, ready }
}
