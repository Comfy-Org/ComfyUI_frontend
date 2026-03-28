import { LiteGraph } from '@/lib/litegraph/src/litegraph'

/** Guard against unbound allocation. */
const UNIQUE_MESSAGE_LIMIT = 10_000
const sentWarnings: Set<string> = new Set()

/**
 * Warns that a deprecated function has been used via the public
 * {@link onDeprecationWarning} / {@link onEveryDeprecationWarning} callback arrays.
 * @param message Plain-language detail about what has been deprecated. This **should not** include unique data; use {@link source}.
 * @param source A reference object to include alongside the message, e.g. `this`.
 */
export function warnDeprecated(message: string, source?: object): void {
  if (!LiteGraph.alwaysRepeatWarnings) {
    // Do not repeat
    if (sentWarnings.has(message)) return

    // Hard limit of unique messages per session
    if (sentWarnings.size > UNIQUE_MESSAGE_LIMIT) return

    sentWarnings.add(message)
  }

  for (const callback of LiteGraph.onDeprecationWarning) {
    callback(message, source)
  }
}

/**
 * Defines a deprecated property alias that proxies to a current property,
 * logging a deprecation warning on first access.
 *
 * Warning is deduplicated by {@link warnDeprecated} (once per unique message per session).
 *
 * @param target The object to define the deprecated property on.
 * @param deprecatedKey The old property name to deprecate.
 * @param currentKey The new property name to proxy to.
 * @param message The deprecation warning message.
 */
export function defineDeprecatedProperty<T>(
  target: T,
  deprecatedKey: string,
  currentKey: keyof T & string,
  message: string
): void {
  Object.defineProperty(target, deprecatedKey, {
    get() {
      warnDeprecated(message)
      return this[currentKey]
    },
    set(value: unknown) {
      warnDeprecated(message)
      this[currentKey] = value
    },
    configurable: true,
    enumerable: false
  })
}
