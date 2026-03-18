import { computed, onMounted, reactive, toValue } from 'vue'

import type { MaybeRefOrGetter } from 'vue'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { generateErrorReport } from '@/utils/errorReportUtil'

import type { ErrorCardData } from './types'

/** Fallback exception type for error reports when the backend does not provide one. Not i18n'd: used in diagnostic reports only. */
const FALLBACK_EXCEPTION_TYPE = 'Runtime Error'

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

    if (!systemStatsStore.systemStats) {
      await systemStatsStore.refetchSystemStats()
    }
    if (!systemStatsStore.systemStats) return

    let logs: string
    try {
      logs = await api.getLogs()
    } catch {
      logs = 'Failed to retrieve server logs'
    }

    const workflow = app.rootGraph.serialize()

    for (const { error, idx } of runtimeErrors) {
      try {
        const report = generateErrorReport({
          exceptionType: error.exceptionType ?? FALLBACK_EXCEPTION_TYPE,
          exceptionMessage: error.message,
          traceback: error.details,
          nodeId: card.nodeId,
          nodeType: card.title,
          systemStats: systemStatsStore.systemStats,
          serverLogs: logs,
          workflow
        })
        enrichedDetails[idx] = report
      } catch {
        // Fallback: keep original error.details
      }
    }
  })

  return { displayedDetailsMap }
}
