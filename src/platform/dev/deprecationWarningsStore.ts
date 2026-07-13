import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'

interface DeprecationWarning {
  key: string
  message: string
  suggestion?: string
  /** Subsystem that reported the deprecation, e.g. 'nodeDef'. */
  source?: string
  /** Extension or node pack that triggered it, e.g. 'custom_nodes.devtools'. */
  extension?: string
  /** Specific locator within the source, e.g. an affected node/input or method. */
  detail?: string
  docsUrl?: string
  count: number
  lastSeenAt: number
}

export interface ReportDeprecationInput {
  message: string
  suggestion?: string
  source?: string
  extension?: string
  detail?: string
  docsUrl?: string
}

/** Guard against unbounded growth from high-cardinality reports. */
const MAX_TRACKED_DEPRECATIONS = 10_000

function deprecationKey(input: ReportDeprecationInput): string {
  return JSON.stringify([
    input.source ?? '',
    input.message,
    input.extension ?? '',
    input.detail ?? ''
  ])
}

const pendingBuffer = new Map<
  string,
  { input: ReportDeprecationInput; count: number }
>()

/**
 * Buffers a deprecation reported before Pinia is active, deduped by key and
 * capped. Returns true the first time a key is buffered, so callers log to
 * the console once per unique deprecation.
 */
export function bufferDeprecation(input: ReportDeprecationInput): boolean {
  const key = deprecationKey(input)
  const buffered = pendingBuffer.get(key)
  if (buffered) {
    buffered.count += 1
    return false
  }
  if (pendingBuffer.size >= MAX_TRACKED_DEPRECATIONS) return false
  pendingBuffer.set(key, { input, count: 1 })
  return true
}

export const useDeprecationWarningsStore = defineStore(
  'deprecationWarnings',
  () => {
    const warningsByKey = reactive(new Map<string, DeprecationWarning>())
    const unseenKeys = reactive(new Set<string>())

    const warnings = computed<DeprecationWarning[]>(() =>
      Array.from(warningsByKey.values()).reverse()
    )
    const unseenCount = computed(() => unseenKeys.size)

    function report(
      input: ReportDeprecationInput,
      occurrences: number = 1
    ): boolean {
      const key = deprecationKey(input)
      const now = Date.now()
      const existing = warningsByKey.get(key)

      if (existing) {
        existing.count += occurrences
        existing.lastSeenAt = now
        warningsByKey.delete(key)
        warningsByKey.set(key, existing)
        return false
      }

      if (warningsByKey.size >= MAX_TRACKED_DEPRECATIONS) return false

      warningsByKey.set(key, {
        key,
        message: input.message,
        suggestion: input.suggestion,
        source: input.source,
        extension: input.extension,
        detail: input.detail,
        docsUrl: input.docsUrl,
        count: occurrences,
        lastSeenAt: now
      })
      unseenKeys.add(key)
      return true
    }

    function markAllSeen(): void {
      unseenKeys.clear()
    }

    function clear(): void {
      warningsByKey.clear()
      unseenKeys.clear()
    }

    function remove(key: string): void {
      warningsByKey.delete(key)
      unseenKeys.delete(key)
    }

    for (const { input, count } of pendingBuffer.values()) report(input, count)
    pendingBuffer.clear()

    return {
      warnings,
      unseenCount,
      report,
      markAllSeen,
      clear,
      remove
    }
  }
)
