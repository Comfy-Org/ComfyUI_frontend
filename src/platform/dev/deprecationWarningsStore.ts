import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'

interface DeprecationWarning {
  key: string
  message: string
  suggestion?: string
  source?: string
  count: number
  lastSeenAt: number
}

export interface ReportDeprecationInput {
  message: string
  suggestion?: string
  source?: string
}

function deprecationKey(input: ReportDeprecationInput): string {
  return `${input.source ?? ''}::${input.message}`
}

const pendingBuffer: ReportDeprecationInput[] = []

export function bufferDeprecation(input: ReportDeprecationInput): void {
  pendingBuffer.push(input)
}

export const useDeprecationWarningsStore = defineStore(
  'deprecationWarnings',
  () => {
    const warningsByKey = reactive(new Map<string, DeprecationWarning>())
    const unseenKeys = reactive(new Set<string>())

    const warnings = computed<DeprecationWarning[]>(() =>
      Array.from(warningsByKey.values()).sort(
        (a, b) => b.lastSeenAt - a.lastSeenAt
      )
    )
    const unseenCount = computed(() => unseenKeys.size)

    function report(input: ReportDeprecationInput): boolean {
      const key = deprecationKey(input)
      const now = Date.now()
      const existing = warningsByKey.get(key)

      if (existing) {
        existing.count += 1
        existing.lastSeenAt = now
        return false
      }

      warningsByKey.set(key, {
        key,
        message: input.message,
        suggestion: input.suggestion,
        source: input.source,
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

    return {
      warnings,
      unseenCount,
      report,
      markAllSeen,
      clear
    }
  }
)
