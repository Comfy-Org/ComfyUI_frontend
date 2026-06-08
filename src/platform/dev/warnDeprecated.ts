import { getActivePinia } from 'pinia'

import type {
  DeprecationEntry,
  DeprecationId
} from '@/platform/dev/deprecations'
import {
  DEPRECATIONS,
  formatDeprecationConsole
} from '@/platform/dev/deprecations'
import type { ReportDeprecationInput } from '@/platform/dev/deprecationWarningsStore'
import {
  bufferDeprecation,
  useDeprecationWarningsStore
} from '@/platform/dev/deprecationWarningsStore'

interface WarnDeprecatedOptions {
  /** Extension or node pack that triggered the deprecation, surfaced as a tag. */
  extension?: string
  /** Specific locator within the source, e.g. an affected node/input or method. */
  detail?: string
}

function resolveDeprecation(
  id: DeprecationId,
  options: WarnDeprecatedOptions
): ReportDeprecationInput {
  const entry: DeprecationEntry = DEPRECATIONS[id]
  return {
    message: entry.message,
    suggestion: entry.suggestion,
    source: entry.source,
    docsUrl: entry.docsUrl,
    extension: options.extension,
    detail: options.detail
  }
}

export function warnDeprecated(
  id: DeprecationId,
  options: WarnDeprecatedOptions = {}
): void {
  const input = resolveDeprecation(id, options)

  if (!getActivePinia()) {
    if (bufferDeprecation(input)) {
      console.warn(...formatDeprecationConsole(input))
    }
    return
  }

  if (useDeprecationWarningsStore().report(input)) {
    console.warn(...formatDeprecationConsole(input))
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
  id: DeprecationId
): void {
  Object.defineProperty(target, deprecatedKey, {
    get() {
      warnDeprecated(id)
      return this[currentKey]
    },
    set(value: unknown) {
      warnDeprecated(id)
      this[currentKey] = value
    },
    configurable: true,
    enumerable: false
  })
}
