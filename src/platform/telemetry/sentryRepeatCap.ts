import type { ErrorEvent } from '@sentry/vue'

const MAX_SENTRY_EVENTS_PER_SIGNATURE = 3

const sentCounts = new Map<string, number>()

function fingerprintSignature(event: ErrorEvent): string | undefined {
  return event.fingerprint?.length
    ? `fp:${JSON.stringify(event.fingerprint)}`
    : undefined
}

function exceptionSignature(event: ErrorEvent): string | undefined {
  const exception = event.exception?.values?.at(-1)
  if (!exception?.type && !exception?.value) return undefined
  return `exc:${JSON.stringify([exception.type ?? '', exception.value ?? ''])}`
}

function signatureOf(event: ErrorEvent): string | undefined {
  const fingerprint = fingerprintSignature(event)
  if (fingerprint) return fingerprint
  const head = exceptionSignature(event) ?? event.message
  if (!head) return undefined
  const errorType = event.tags?.error_type
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
