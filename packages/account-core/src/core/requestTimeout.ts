export interface TimedSignal {
  readonly signal: AbortSignal | undefined
  /** Disarms the timer; call once the response body has been read. */
  readonly release: () => void
}

/** Joins the caller's signal with an abort after `timeoutMs`, if one is set. */
export function timedSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined
): TimedSignal {
  if (timeoutMs === undefined) return { signal, release: () => undefined }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal,
    release: () => clearTimeout(timer)
  }
}
