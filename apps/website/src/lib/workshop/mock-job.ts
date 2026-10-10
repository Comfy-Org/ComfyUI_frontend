/**
 * A stand-in for a backend job: settles with `answer` after `delayMs`, or
 * rejects as soon as `signal` aborts.
 */
export function mockJob<T>(
  answer: T,
  signal: AbortSignal,
  delayMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(answer)
    }, delayMs)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * A stand-in for a backend job that answers with an image drawn in the
 * browser: starts `render` at once, settles with its object URL after
 * `delayMs`, and releases that URL when `signal` aborts first.
 */
export async function mockRenderJob(
  render: () => Promise<string | undefined>,
  signal: AbortSignal,
  delayMs: number
): Promise<string | undefined> {
  const rendered = render().catch(() => undefined)
  try {
    await mockJob(undefined, signal, delayMs)
  } catch (error) {
    void rendered.then((url) => url && URL.revokeObjectURL(url))
    throw error
  }
  return rendered
}
