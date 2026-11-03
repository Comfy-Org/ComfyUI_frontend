import type { ErrorEvent } from '@sentry/vue'

const VITE_PRELOAD_ERROR = 'vite_preload_error'
const PRELOAD_BREADCRUMB_PREFIX = `[Reported error]: ${VITE_PRELOAD_ERROR}`
const FOLLOW_ON_WINDOW_SECONDS = 5
const UNDEFINED_FOLLOW_ON_PATTERNS = [
  /^Cannot destructure property .+ as it is undefined\.?$/,
  /^Cannot read propert(?:y|ies) of undefined\b/,
  /^undefined is not an object \(evaluating .+\)$/,
  /^undefined has no properties$/
]

function isUndefinedFollowOn(event: ErrorEvent): boolean {
  const exceptions = event.exception?.values ?? []
  const value = exceptions.at(-1)?.value
  return (
    typeof value === 'string' &&
    UNDEFINED_FOLLOW_ON_PATTERNS.some((pattern) => pattern.test(value))
  )
}

export function tagSentryStaleChunkCause(event: ErrorEvent): ErrorEvent {
  try {
    if (
      event.tags?.error_type === VITE_PRELOAD_ERROR ||
      !event.timestamp ||
      !isUndefinedFollowOn(event)
    ) {
      return event
    }

    const breadcrumb = [...(event.breadcrumbs ?? [])]
      .reverse()
      .find(({ message }) => message?.startsWith(PRELOAD_BREADCRUMB_PREFIX))
    if (!breadcrumb?.timestamp) return event

    const age = event.timestamp - breadcrumb.timestamp
    if (age < 0 || age > FOLLOW_ON_WINDOW_SECONDS) return event

    return {
      ...event,
      tags: { ...event.tags, error_cause: VITE_PRELOAD_ERROR }
    }
  } catch {
    return event
  }
}
