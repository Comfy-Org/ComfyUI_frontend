import { combineAbortSignals } from './abortSignal'

/**
 * The response deadline `fetchApi` arms behind a request's signal, as a fetch
 * wrapper below it sees it. A wrapper that holds a request after its answer
 * (and then sends it again) stops the deadline while it holds, keeps
 * honouring the caller's own cancellation, and restarts the deadline before
 * anything is sent again. The deadline stays on the same signal, so every
 * later send of the request (the wrapper's resend and any status retry above
 * it) is bounded by it.
 */
export interface AttemptDeadline {
  /** The caller's own signal, without the deadline. */
  readonly callerSignal: AbortSignal | undefined
  /** Stops the deadline; the signal stays unaborted until it is restarted. */
  stop(): void
  /** Arms the deadline again, in full, on the same signal. */
  restart(): void
}

/** A response deadline as its owner sees it. */
export interface ResponseDeadline {
  /** The caller's signal plus the deadline; pass it as the request's signal. */
  readonly signal: AbortSignal
  stop(): void
}

const deadlines = new WeakMap<AbortSignal, AttemptDeadline>()

/**
 * Arms a deadline of `durationMs` behind a signal that also follows
 * `callerSignal`. When it expires, `onTimeout` runs and the signal aborts
 * with a `TimeoutError`.
 */
export function startResponseDeadline(
  durationMs: number,
  callerSignal: AbortSignal | undefined,
  onTimeout: () => void
): ResponseDeadline {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => clearTimeout(timer)
  const restart = () => {
    stop()
    timer = setTimeout(() => {
      onTimeout()
      controller.abort(new DOMException('Fetch timeout', 'TimeoutError'))
    }, durationMs)
  }
  const signal = callerSignal
    ? combineAbortSignals([callerSignal, controller.signal])
    : controller.signal
  deadlines.set(signal, { callerSignal, stop, restart })
  restart()
  return { signal, stop }
}

/** The deadline `fetchApi` armed behind `signal`, or undefined when no deadline owns it. */
export function attemptDeadlineOf(
  signal: AbortSignal | null | undefined
): AttemptDeadline | undefined {
  return signal ? deadlines.get(signal) : undefined
}
