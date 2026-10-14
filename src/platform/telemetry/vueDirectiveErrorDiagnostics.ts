import type { ErrorEvent, EventHint } from '@sentry/vue'

const MAX_SCRIPT_PATHS = 250

// FE-3163: remove after a recurrence identifies the failing asset graph.
performance.setResourceTimingBufferSize(1000)

function eventMessages(event: ErrorEvent, hint: EventHint): string[] {
  const messages = [event.message]
  const originalException = hint.originalException
  if (originalException instanceof Error)
    messages.push(originalException.message)
  if (typeof originalException === 'string') messages.push(originalException)
  event.exception?.values?.forEach((exception) => {
    messages.push(exception.value)
  })
  return messages.filter((message) => message !== undefined)
}

function isVueDirectiveFailure(event: ErrorEvent, hint: EventHint): boolean {
  const frames =
    event.exception?.values?.flatMap(
      (exception) => exception.stacktrace?.frames ?? []
    ) ?? []
  if (frames.some((frame) => frame.function?.includes('withDirectives')))
    return true

  const hasVueCoreFrame = frames.some((frame) =>
    frame.filename?.includes('vendor-vue-core')
  )
  return (
    hasVueCoreFrame &&
    eventMessages(event, hint).some((message) =>
      message.includes('undefined is not a function')
    )
  )
}

function firstPartyScriptPaths(): string[] {
  try {
    return performance
      .getEntriesByType('resource')
      .map((entry) => new URL(entry.name, window.location.href))
      .filter(
        (url) =>
          url.origin === window.location.origin && url.pathname.endsWith('.js')
      )
      .map((url) => url.pathname)
      .slice(0, MAX_SCRIPT_PATHS)
  } catch {
    return []
  }
}

export function addVueDirectiveDiagnostics(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent {
  if (!isVueDirectiveFailure(event, hint)) return event

  const scriptPaths = firstPartyScriptPaths()
  return {
    ...event,
    tags: {
      ...event.tags,
      diagnostic: 'vue_directive_runtime'
    },
    contexts: {
      ...event.contexts,
      vue_directive_runtime: {
        frontend_version: __COMFYUI_FRONTEND_VERSION__,
        frontend_commit: __COMFYUI_FRONTEND_COMMIT__,
        loaded_script_count: scriptPaths.length,
        first_party_script_paths: scriptPaths
      }
    }
  }
}
