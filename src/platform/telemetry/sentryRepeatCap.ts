import type { ErrorEvent } from '@sentry/vue'

const MAX_SENTRY_EVENTS_PER_SIGNATURE = 3

const sentCounts = new Map<string, number>()

function signatureOf(event: ErrorEvent): string | undefined {
  if (event.fingerprint?.length)
    return `fp:${JSON.stringify(event.fingerprint)}`
  const exception = event.exception?.values?.at(-1)
  const errorType = event.tags?.error_type
  const exceptionHead =
    exception?.type || exception?.value
      ? `exc:${JSON.stringify([exception.type ?? '', exception.value ?? ''])}`
      : undefined
  const head = exceptionHead ?? event.message
  if (!head) return undefined
  return `${typeof errorType === 'string' ? errorType : ''}|${head}`
}

/** Drops an event after its signature reaches the per-page limit. */
export function capRepeatedSentryEvent(
  event: ErrorEvent
): ErrorEvent | undefined {
  const signature = signatureOf(event)
  if (signature === undefined) return event
  const sent = sentCounts.get(signature) ?? 0
  if (sent >= MAX_SENTRY_EVENTS_PER_SIGNATURE) return undefined
  sentCounts.set(signature, sent + 1)
  return event
}

export function resetSentryRepeatCapForTests(): void {
  sentCounts.clear()
}
