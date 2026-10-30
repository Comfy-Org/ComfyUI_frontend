import type { ErrorEvent } from '@sentry/vue'

const UNKNOWN_COMMAND = /^Command \S+ not found$/
const COMMAND_STORE_FRAME_DEPTH = 2

/**
 * `app.extensionManager.command.execute` is public and takes any string, so a
 * console snippet, userscript or browser automation can reject it with an ID
 * that never existed. Code evaluated in the page reports a script of
 * `<anonymous>` with a line number; engine builtins, which share that name,
 * have none.
 */
function isCalledFromEvaluatedCode(event: ErrorEvent): boolean {
  const exception = event.exception?.values?.at(-1)
  if (!UNKNOWN_COMMAND.test(exception?.value ?? '')) return false

  const caller = exception?.stacktrace?.frames?.at(
    -(COMMAND_STORE_FRAME_DEPTH + 1)
  )
  return caller?.filename === '<anonymous>' && caller.lineno !== undefined
}

/**
 * Keeps these events in Sentry, marked so the alert rule's
 * `error_origin` filter does not page for them.
 */
export function tagSentryEvaluatedCommandCaller(event: ErrorEvent): ErrorEvent {
  if (!isCalledFromEvaluatedCode(event)) return event
  return { ...event, tags: { ...event.tags, error_origin: 'third_party' } }
}
