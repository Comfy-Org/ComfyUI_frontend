import { computed, onMounted, reactive, toValue } from 'vue'

import type { MaybeRefOrGetter } from 'vue'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { generateErrorReport } from '@/utils/errorReportUtil'

import type { ErrorCardData } from './types'

/** Module-level cache keyed by card ID + error index + error message to avoid stale entries. */
const reportCache = new Map<string, string>()

/** @internal Exposed for test cleanup only. */
export function clearReportCache() {
  reportCache.clear()
}

function cacheKey(cardId: string, idx: number, message: string): string {
  return `${cardId}-${idx}-${message}`
}

export function useErrorReport(cardSource: MaybeRefOrGetter<ErrorCardData>) {
  const systemStatsStore = useSystemStatsStore()
  const enrichedDetails = reactive<Record<number, string>>({})

  const displayedDetailsMap = computed(() => {
    const card = toValue(cardSource)
    return Object.fromEntries(
      card.errors.map((error, idx) => [
        idx,
        enrichedDetails[idx] ?? error.details
      ])
    )
  })

  onMounted(async () => {
    const card = toValue(cardSource)
    const runtimeErrors = card.errors
      .map((error, idx) => ({ error, idx }))
      .filter(({ error }) => error.isRuntimeError)

    if (runtimeErrors.length === 0) return

    // Resolve cached entries first; collect uncached ones
    const uncached: typeof runtimeErrors = []
    for (const entry of runtimeErrors) {
      const key = cacheKey(card.id, entry.idx, entry.error.message)
      if (reportCache.has(key)) {
        enrichedDetails[entry.idx] = reportCache.get(key)!
      } else {
        uncached.push(entry)
      }
    }

    if (uncached.length === 0) return

    if (!systemStatsStore.systemStats) {
      await systemStatsStore.refetchSystemStats()
    }
    if (!systemStatsStore.systemStats) return

    let logs: string
    try {
      logs = await api.getLogs()
    } catch {
      return
    }

    const workflow = app.rootGraph.serialize()

    for (const { error, idx } of uncached) {
      try {
        const report = generateErrorReport({
          exceptionType: card.title,
          exceptionMessage: error.message,
          traceback: error.details,
          nodeId: card.nodeId,
          nodeType: card.title,
          systemStats: systemStatsStore.systemStats,
          serverLogs: logs,
          workflow
        })
        enrichedDetails[idx] = report
        reportCache.set(cacheKey(card.id, idx, error.message), report)
      } catch {
        // Fallback: keep original error.details
      }
    }
  })

  return { displayedDetailsMap }
}
