const presentedGraphLoadFailures = new WeakSet<object>()

function normaliseGraphLoadFailure(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(typeof error === 'string' ? error : String(error))
}

export function markGraphLoadFailurePresented(error: unknown): Error {
  const failure = normaliseGraphLoadFailure(error)
  presentedGraphLoadFailures.add(failure)
  return failure
}

export function isGraphLoadFailurePresented(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    presentedGraphLoadFailures.has(error)
  )
}
