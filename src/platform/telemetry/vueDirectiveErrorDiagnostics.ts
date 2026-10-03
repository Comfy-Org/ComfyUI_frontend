import type { ErrorEvent, EventHint } from '@sentry/vue'

import { sentryThirdPartyErrorFilter } from './thirdPartyErrorNoise'

const startupArrayIterator = Array.prototype[Symbol.iterator]
const functionToString = Function.prototype.toString
const MAX_SCRIPT_PATHS = 40

function eventMessages(event: ErrorEvent, hint: EventHint): string[] {
  const messages = [event.message]
  const originalException = hint.originalException
  if (originalException instanceof Error)
    messages.push(originalException.message)
  if (typeof originalException === 'string') messages.push(originalException)
  for (const exception of event.exception?.values ?? []) {
    messages.push(exception.value)
  }
  return messages.filter((message): message is string => Boolean(message))
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
    return Array.from(document.scripts)
      .map((script) => script.src)
      .filter(Boolean)
      .map((source) => new URL(source, window.location.href))
      .filter((url) => url.origin === window.location.origin)
      .map((url) => url.pathname)
      .slice(0, MAX_SCRIPT_PATHS)
  } catch {
    return []
  }
}

function iteratorLooksNative(iterator: unknown): boolean {
  if (typeof iterator !== 'function') return false
  try {
    return functionToString.call(iterator).includes('[native code]')
  } catch {
    return false
  }
}

export function prepareSentryEvent(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent | null {
  const filteredEvent = sentryThirdPartyErrorFilter(event, hint)
  if (!filteredEvent || !isVueDirectiveFailure(filteredEvent, hint))
    return filteredEvent

  const currentArrayIterator = Array.prototype[Symbol.iterator]
  const scriptPaths = firstPartyScriptPaths()
  return {
    ...filteredEvent,
    tags: {
      ...filteredEvent.tags,
      diagnostic: 'vue_directive_runtime',
      array_iterator_callable: typeof currentArrayIterator === 'function',
      array_iterator_unchanged: currentArrayIterator === startupArrayIterator
    },
    contexts: {
      ...filteredEvent.contexts,
      vue_directive_runtime: {
        frontend_version: __COMFYUI_FRONTEND_VERSION__,
        frontend_commit: __COMFYUI_FRONTEND_COMMIT__,
        array_iterator_native: iteratorLooksNative(currentArrayIterator),
        loaded_script_count: document.scripts.length,
        first_party_script_paths: scriptPaths
      }
    }
  }
}
