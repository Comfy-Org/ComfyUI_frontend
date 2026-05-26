import { LiteGraph } from '@/lib/litegraph/src/litegraph'

/** Guard against unbound allocation. */
const UNIQUE_MESSAGE_LIMIT = 10_000
const sentWarnings: Set<string> = new Set()

/**
 * Litegraph-internal deprecation dispatcher. Fires
 * {@link LiteGraph.onDeprecationWarning} callbacks once per unique message
 * (unless {@link LiteGraph.alwaysRepeatWarnings}).
 *
 * Frontend code outside the litegraph package should use
 * `warnDeprecated` from `@/platform/dev/warnDeprecated` instead.
 *
 * @param message Plain-language detail about what has been deprecated. This **should not** include unique data; use {@link source}.
 * @param source A reference object to include alongside the message, e.g. `this`.
 */
export function dispatchLitegraphDeprecation(
  message: string,
  source?: object
): void {
  if (!LiteGraph.alwaysRepeatWarnings) {
    if (sentWarnings.has(message)) return
    if (sentWarnings.size > UNIQUE_MESSAGE_LIMIT) return
    sentWarnings.add(message)
  }

  for (const callback of LiteGraph.onDeprecationWarning) {
    callback(message, source)
  }
}
