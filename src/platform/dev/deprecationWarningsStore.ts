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

const pendingBuffer: ReportDeprecationInput[] = []
const pendingConsoledKeys = new Set<string>()

/**
 * Buffers a deprecation reported before Pinia is active. Returns whether this
 * is the first time the key has been buffered, so callers log to the console
 * once per unique deprecation — mirroring the store's dedup, which is otherwise
 * unavailable until the store exists.
 */
export function bufferDeprecation(input: ReportDeprecationInput): boolean {
  pendingBuffer.push(input)
  const key = deprecationKey(input)
  if (pendingConsoledKeys.has(key)) return false
  pendingConsoledKeys.add(key)
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

    function report(input: ReportDeprecationInput): boolean {
      const key = deprecationKey(input)
      const now = Date.now()
      const existing = warningsByKey.get(key)

      if (existing) {
        existing.count += 1
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
        count: 1,
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

    for (const input of pendingBuffer.splice(0)) report(input)
    pendingConsoledKeys.clear()

    return {
      warnings,
      unseenCount,
      report,
      markAllSeen,
      clear
    }
  }
)
