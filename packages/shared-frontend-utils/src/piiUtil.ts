import { stripUrlQuery } from './telemetry'

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

function stripUrlQueries(bag?: Record<string, unknown>): void {
  if (!bag) return
  for (const [key, value] of Object.entries(bag)) {
    if (typeof value === 'string' && /^https?:\/\//.test(value))
      bag[key] = stripUrlQuery(value)
  }
}

/**
 * PostHog before_send hook that drops the query and fragment from every URL
 * an event carries, such as `$current_url` on a pageview: a billing return
 * URL holds a payment client secret.
 */
export function createPostHogUrlQueryScrub() {
  return function beforeSend<E extends PostHogEventLike>(
    event: E | null
  ): E | null {
    if (!event) return null
    stripUrlQueries(event.properties)
    stripUrlQueries(event.$set)
    stripUrlQueries(event.$set_once)
    return event
  }
}
