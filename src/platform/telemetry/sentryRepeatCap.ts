import type { ErrorEvent } from '@sentry/vue'

/**
 * Events a single page load may send for one signature. The first few carry
 * every distinct breadcrumb trail worth reading; the rest of a storm (a
 * diagnostic firing on every serialize, a retry loop) only burns quota.
 */
export const MAX_SENTRY_EVENTS_PER_SIGNATURE = 3

const sentCounts = new Map<string, number>()

function signatureOf(event: ErrorEvent): string | undefined {
  if (event.fingerprint?.length) return `fp:${event.fingerprint.join('|')}`
  const exception = event.exception?.values?.at(-1)
  const errorType = event.tags?.error_type
  const head = exception
    ? `${exception.type ?? ''}:${exception.value ?? ''}`
    : event.message
  if (!head) return undefined
  return `${typeof errorType === 'string' ? errorType : ''}|${head}`
}

/**
 * Drops an error event once its signature has already been sent
 * {@link MAX_SENTRY_EVENTS_PER_SIGNATURE} times on this page. Sentry's
 * built-in dedupe only collapses back-to-back identical events, so an
 * interleaved repeat would otherwise be sent every time.
 */
export function capRepeatedSentryEvent(event: ErrorEvent): ErrorEvent | null {
  const signature = signatureOf(event)
  if (signature === undefined) return event
  const sent = sentCounts.get(signature) ?? 0
  if (sent >= MAX_SENTRY_EVENTS_PER_SIGNATURE) return null
  sentCounts.set(signature, sent + 1)
  return event
}

export function resetSentryRepeatCapForTests(): void {
  sentCounts.clear()
}
