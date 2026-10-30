import type { ErrorEvent } from '@sentry/vue'

const UNKNOWN_COMMAND = /^Command .* not found$/s
const COMMAND_STORE_FRAME_DEPTH = 2

function isCalledFromEvaluatedCode(event: ErrorEvent): boolean {
  const exception = event.exception?.values?.at(-1)
  if (!UNKNOWN_COMMAND.test(exception?.value ?? '')) return false

  const caller = exception?.stacktrace?.frames?.at(
    -(COMMAND_STORE_FRAME_DEPTH + 1)
  )
  return caller?.filename === '<anonymous>' && caller.lineno !== undefined
}

export function tagSentryEvaluatedCommandCaller(event: ErrorEvent): ErrorEvent {
  if (!isCalledFromEvaluatedCode(event)) return event
  return { ...event, tags: { ...event.tags, error_origin: 'third_party' } }
}
