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

function isResendable(input: RequestInfo | URL): boolean {
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

/**
 * Holds until the GPU is ready, then sends again; answers the first response
 * when it never becomes ready. Under `api.fetchApi` the request's deadline
 * stops while held and restarts in full before anything is sent again, so the
 * resend and any status retry above this wrapper stay bounded by it.
 */
async function resendWhenReady(
  send: Fetch,
  hold: GpuRequestHold,
  response: Response,
  input: RequestInfo | URL,
  init: RequestInit | undefined
): Promise<Response> {
  const deadline = attemptDeadlineOf(init?.signal)
  const cancelSignal = deadline
    ? deadline.callerSignal
    : (init?.signal ?? undefined)
  deadline?.stop()
  const ready = await waitReadyUnlessCancelled(hold, cancelSignal).finally(() =>
    deadline?.restart()
  )
  return ready ? send(input, init) : response
}

/**
 * Wraps `send` so a request answered 503 `gpu_starting` is sent again once the
 * GPU is ready. Under `api.fetchApi` the first attempt already has its answer,
 * so its response deadline stops while the request is held and restarts before
 * the request is sent again; the caller's signal still cancels the hold.
 */
export function holdWhileGpuStarts(send: Fetch, hold: GpuStartingHold): Fetch {
  return async (input, init) => {
    const requestHold = hold.forRequest()
    const response = await send(input, init)
    const answer = await readGpuAnswer(response)
    if (answer === null) return response
    requestHold.answered(answer)
    if (!shouldHold(answer, input)) return response
    return resendWhenReady(send, requestHold, response, input, init)
  }
}
