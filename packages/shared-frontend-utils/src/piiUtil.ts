const PII_KEYS = ['email', 'prompt', 'user_email', '$email'] as const

function stripPiiKeys(obj?: Record<string, unknown>): void {
  if (!obj) return
  for (const key of PII_KEYS) {
    delete obj[key]
  }
}

/**
 * PostHog before_send hook that strips PII from all three property bags
 * an event can carry: properties, $set, and $set_once.
 *
 * posthog.identify(id, { email }) lands in $set, not properties, so all
 * three bags must be sanitized.
 *
 * Ref: posthog.com/tutorials/web-redact-properties
 */
interface PostHogEventLike {
  properties?: Record<string, unknown>
  $set?: Record<string, unknown>
  $set_once?: Record<string, unknown>
}

export function createPostHogBeforeSend() {
  return function beforeSend<E extends PostHogEventLike>(
    event: E | null
  ): E | null {
    if (!event) return null
    stripPiiKeys(event.properties)
    stripPiiKeys(event.$set)
    stripPiiKeys(event.$set_once)
    return event
  }
}
