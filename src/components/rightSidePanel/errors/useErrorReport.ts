import { computed, reactive, toValue, watch } from 'vue'

import type { MaybeRefOrGetter } from 'vue'

import { until } from '@vueuse/core'

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

  watch(
    () => toValue(cardSource),
    async (card, _, onCleanup) => {
      let cancelled = false
      onCleanup(() => {
        cancelled = true
      })

      for (const key of Object.keys(enrichedDetails)) {
        delete enrichedDetails[Number(key)]
      }

      const runtimeErrors = card.errors
        .map((error, idx) => ({ error, idx }))
        .filter(({ error }) => error.isRuntimeError)

      if (runtimeErrors.length === 0) return

      if (!systemStatsStore.systemStats) {
        if (systemStatsStore.isLoading) {
          await until(systemStatsStore.isLoading).toBe(false)
        } else {
          try {
            await systemStatsStore.refetchSystemStats()
          } catch (e) {
            console.warn('Failed to fetch system stats for error report:', e)
            return
          }
        }
      }
      if (!systemStatsStore.systemStats || cancelled) return

      const logs = await api
        .getLogs()
        .catch(() => 'Failed to retrieve server logs')
      if (cancelled) return

      const workflow = (() => {
        try {
          return app.rootGraph.serialize()
        } catch (e) {
          console.warn('Failed to serialize workflow for error report:', e)
          return null
        }
      })()
      if (!workflow) return

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
        } catch (e) {
          console.warn('Failed to generate error report:', e)
        }
      }
    },
    { immediate: true }
  )

  return { displayedDetailsMap }
}
