import { attemptDeadlineOf } from '@comfyorg/api-client/attemptDeadline'
import type { GpuAnswer } from '@/platform/workspace/gpuSession'
import { readGpuStartingBody } from '@/platform/workspace/gpuSession'

type Fetch = typeof window.fetch

/** What one request may do to the GPU state of the deployment it was sent for. */
export interface GpuRequestHold {
  answered(answer: GpuAnswer): void
  waitReady(): Promise<boolean>
}

export interface GpuStartingHold {
  /**
   * The hold for a request about to be sent, bound to the deployment picked
   * now: once another deployment is picked, its answer changes nothing and
   * it is not held.
   */
  forRequest(): GpuRequestHold
}

async function readGpuAnswer(response: Response): Promise<GpuAnswer | null> {
  if (response.status !== 503) return null
  if (!(response.headers.get('Content-Type') ?? '').includes('json')) {
    return null
  }
  try {
    return readGpuStartingBody(await response.clone().json())
  } catch {
    return null
  }
}

function isResendable(input: RequestInfo | URL): input is string | URL {
  return typeof input === 'string' || input instanceof URL
}

/** Waits for readiness, rejecting with the caller's reason as soon as the caller cancels. */
function waitReadyUnlessCancelled(
  hold: GpuRequestHold,
  signal: AbortSignal | undefined
): Promise<boolean> {
  if (!signal) return hold.waitReady()
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason)
    signal.addEventListener('abort', cancel, { once: true })
    void hold
      .waitReady()
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', cancel))
  })
}

/** Only a `starting` answer to a request that can be sent again is held. */
function shouldHold(answer: GpuAnswer, input: RequestInfo | URL): boolean {
  return answer === 'starting' && isResendable(input)
}

const GPU_HOLD_HEADER = 'Comfy-Gpu-Hold'

function sameOriginUrl(input: string | URL): URL | null {
  try {
    const url = new URL(input, location.href)
    return url.origin === location.origin ? url : null
  } catch {
    return null
  }
}

function isRunSubmit(
  input: RequestInfo | URL,
  init: RequestInit | undefined
): boolean {
  if (!isResendable(input)) return false
  if (init?.method?.toUpperCase() !== 'POST') return false
  return sameOriginUrl(input)?.pathname.endsWith('/api/prompt') ?? false
}

function withGpuHold(init: RequestInit | undefined): RequestInit {
  const headers = new Headers(init?.headers)
  headers.set(GPU_HOLD_HEADER, '1')
  return { ...init, headers }
}

async function waitWhileHeld(
  hold: GpuRequestHold,
  init: RequestInit | undefined
): Promise<boolean> {
  const deadline = attemptDeadlineOf(init?.signal)
  const cancelSignal = deadline
    ? deadline.callerSignal
    : (init?.signal ?? undefined)
  deadline?.stop()
  return waitReadyUnlessCancelled(hold, cancelSignal).finally(() =>
    deadline?.restart()
  )
}

/**
 * Wraps `send` so a request answered 503 `gpu_starting` is sent again once the
 * GPU is ready; a same-origin Run submit carries `Comfy-Gpu-Hold: 1` and is
 * always sent again without it, as a normal job when the GPU never comes on.
 */
export function holdWhileGpuStarts(send: Fetch, hold: GpuStartingHold): Fetch {
  return async (input, init) => {
    const requestHold = hold.forRequest()
    const run = isRunSubmit(input, init)
    const response = await send(input, run ? withGpuHold(init) : init)
    const answer = await readGpuAnswer(response)
    if (answer === null) return response
    requestHold.answered(answer)
    if (run) {
      if (answer === 'starting') await waitWhileHeld(requestHold, init)
      return send(input, init)
    }
    if (!shouldHold(answer, input)) return response
    const ready = await waitWhileHeld(requestHold, init)
    return ready ? send(input, init) : response
  }
}
