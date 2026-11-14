interface GpuMachine {
  hostname?: string
  boot_id?: string
  gpu_uuid?: string
  gpu_name?: string
  task_id?: string
  container_id?: string
  comfyui_pid?: number
}

interface GpuSessionRun {
  job_id: string
  status?: string
  machine?: GpuMachine
  same_machine?: boolean
}

interface GpuSessionMessage {
  session_id: string
  deployment_id?: string
  state: 'starting' | 'ready' | 'ended'
  reason?: string
  requests?: number
  machine?: GpuMachine
  runs: GpuSessionRun[]
}

const IDLE_CHOICES = [3, 10, 30, 0] as const

type IdleMinutes = (typeof IDLE_CHOICES)[number]

interface EditorGpuSettings {
  on: boolean
  idleMinutes: IdleMinutes
  endOnClose: boolean
}

export type EditorGpuChange =
  | { on: boolean }
  | { idle_minutes: IdleMinutes }
  | { end_on_close: boolean }

export type GpuAnswer = 'starting' | 'off' | 'unavailable'

type GpuPhase = 'idle' | 'starting' | 'ready' | 'unavailable'

export interface GpuSessionState {
  changed: Partial<EditorGpuSettings>
  gpu: GpuPhase
  session: GpuSessionMessage | null
}

export type GpuSessionEvent =
  | {
      type: 'messageReceived'
      message: GpuSessionMessage
      deploymentId: string
    }
  | { type: 'changeSaved'; change: EditorGpuChange; gpu: GpuAnswer | null }
  | { type: 'gpuAnswered'; answer: GpuAnswer }

export const INITIAL_GPU_SESSION: GpuSessionState = {
  changed: {},
  gpu: 'idle',
  session: null
}

const DEFAULT_IDLE_MINUTES: IdleMinutes = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function asIdleMinutes(value: unknown): IdleMinutes | undefined {
  return IDLE_CHOICES.find((choice) => choice === value)
}

function parseMachine(value: unknown): GpuMachine | undefined {
  if (!isRecord(value)) return undefined
  return {
    hostname: optionalString(value.hostname),
    boot_id: optionalString(value.boot_id),
    gpu_uuid: optionalString(value.gpu_uuid),
    gpu_name: optionalString(value.gpu_name),
    task_id: optionalString(value.task_id),
    container_id: optionalString(value.container_id),
    comfyui_pid: optionalNumber(value.comfyui_pid)
  }
}

function parseRun(value: unknown): GpuSessionRun[] {
  if (!isRecord(value) || typeof value.job_id !== 'string') return []
  return [
    {
      job_id: value.job_id,
      status: optionalString(value.status),
      machine: parseMachine(value.machine),
      same_machine:
        typeof value.same_machine === 'boolean' ? value.same_machine : undefined
    }
  ]
}

/** Reads a `gpu_session` socket message, or null when it is not one. */
export function parseGpuSessionMessage(
  value: unknown
): GpuSessionMessage | null {
  if (!isRecord(value) || typeof value.session_id !== 'string') return null
  const { state } = value
  if (state !== 'starting' && state !== 'ready' && state !== 'ended') {
    return null
  }
  return {
    session_id: value.session_id,
    deployment_id: optionalString(value.deployment_id),
    state,
    reason: optionalString(value.reason),
    requests: optionalNumber(value.requests),
    machine: parseMachine(value.machine),
    runs: Array.isArray(value.runs) ? value.runs.flatMap(parseRun) : []
  }
}

/** The GPU settings a deployment list entry carries, or null when it carries none. */
export function readEditorGpuSettings(
  entry: unknown
): EditorGpuSettings | null {
  if (!isRecord(entry) || typeof entry.editor_gpu !== 'boolean') return null
  return {
    on: entry.editor_gpu,
    idleMinutes:
      asIdleMinutes(entry.editor_gpu_idle_minutes) ?? DEFAULT_IDLE_MINUTES,
    endOnClose: entry.editor_gpu_end_on_close !== false
  }
}

/** The `gpu` field of a 503 `gpu_starting` answer, or null for any other body. */
export function readGpuStartingBody(body: unknown): GpuAnswer | null {
  if (!isRecord(body) || body.code !== 'gpu_starting') return null
  return body.gpu === 'starting' || body.gpu === 'off'
    ? body.gpu
    : 'unavailable'
}

/** The GPU's state in the answer to turning the toggle on, or null when it names none. */
export function readSavedGpu(body: unknown): GpuAnswer | null {
  if (!isRecord(body)) return null
  const { gpu } = body
  return gpu === 'starting' || gpu === 'off' || gpu === 'unavailable'
    ? gpu
    : null
}

function savedSettings(change: EditorGpuChange): Partial<EditorGpuSettings> {
  if ('on' in change) return { on: change.on }
  if ('idle_minutes' in change) return { idleMinutes: change.idle_minutes }
  return { endOnClose: change.end_on_close }
}

/**
 * The phase an HTTP answer that says the GPU is starting leads to. The socket
 * may already have said ready before that answer arrived, so a late answer
 * cannot take readiness back; only an `ended` message does.
 */
function phaseAfterStarting(current: GpuPhase): GpuPhase {
  return current === 'ready' ? 'ready' : 'starting'
}

function phaseAfterTurningOn(
  current: GpuPhase,
  gpu: GpuAnswer | null
): GpuPhase {
  return gpu === 'unavailable' ? 'unavailable' : phaseAfterStarting(current)
}

function receiveMessage(
  state: GpuSessionState,
  message: GpuSessionMessage,
  deploymentId: string
): GpuSessionState {
  if (message.deployment_id && message.deployment_id !== deploymentId) {
    return state
  }
  const gpu = message.state === 'ended' ? 'idle' : message.state
  return { ...state, gpu, session: message }
}

function turnOff(state: GpuSessionState): GpuSessionState {
  return { ...state, changed: { ...state.changed, on: false }, gpu: 'idle' }
}

export function reduceGpuSession(
  state: GpuSessionState,
  event: GpuSessionEvent
): GpuSessionState {
  switch (event.type) {
    case 'messageReceived':
      return receiveMessage(state, event.message, event.deploymentId)
    case 'changeSaved': {
      const changed = { ...state.changed, ...savedSettings(event.change) }
      if (!('on' in event.change)) return { ...state, changed }
      if (event.change.on && event.gpu === 'off') return turnOff(state)
      return {
        ...state,
        changed,
        gpu: event.change.on
          ? phaseAfterTurningOn(state.gpu, event.gpu)
          : 'idle'
      }
    }
    case 'gpuAnswered':
      if (event.answer === 'off') return turnOff(state)
      if (event.answer === 'starting') {
        return { ...state, gpu: phaseAfterStarting(state.gpu) }
      }
      return { ...state, gpu: event.answer }
  }
}
