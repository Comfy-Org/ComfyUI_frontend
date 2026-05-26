import { getActivePinia } from 'pinia'

import type { ReportDeprecationInput } from '@/platform/dev/deprecationWarningsStore'
import {
  bufferDeprecation,
  useDeprecationWarningsStore
} from '@/platform/dev/deprecationWarningsStore'

type WarnDeprecatedOptions = Omit<ReportDeprecationInput, 'message'>

function formatConsoleMessage(input: ReportDeprecationInput): string {
  const tag = input.source ? `[DEPRECATED:${input.source}]` : '[DEPRECATED]'
  const suggestionSuffix = input.suggestion ? ` ${input.suggestion}` : ''
  return `${tag} ${input.message}${suggestionSuffix}`
}

export function warnDeprecated(
  message: string,
  options: WarnDeprecatedOptions = {}
): void {
  const input: ReportDeprecationInput = { message, ...options }

  if (!getActivePinia()) {
    bufferDeprecation(input)
    console.warn(formatConsoleMessage(input))
    return
  }

  if (useDeprecationWarningsStore().report(input)) {
    console.warn(formatConsoleMessage(input))
  }
}

/**
 * Defines a deprecated property alias that proxies to a current property,
 * logging a deprecation warning via {@link warnDeprecated} on first access.
 */
export function defineDeprecatedProperty<T>(
  target: T,
  deprecatedKey: string,
  currentKey: keyof T & string,
  message: string,
  options: WarnDeprecatedOptions = {}
): void {
  Object.defineProperty(target, deprecatedKey, {
    get() {
      warnDeprecated(message, options)
      return this[currentKey]
    },
    set(value: unknown) {
      warnDeprecated(message, options)
      this[currentKey] = value
    },
    configurable: true,
    enumerable: false
  })
}
