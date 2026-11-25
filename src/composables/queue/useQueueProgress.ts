import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useExecutionStore } from '@/stores/executionStore'
import { clampPercentInt, formatPercent0 } from '@/utils/numberUtil'

const withDefault = <T>(value: T | null | undefined, fallback: T): T =>
  value ?? fallback

export function useQueueProgress() {
  const { locale } = useI18n()
  const executionStore = useExecutionStore()

  const totalPercent = computed(() =>
    clampPercentInt(
      Math.round(withDefault(executionStore.executionProgress, 0) * 100)
    )
  )

  const totalPercentFormatted = computed(() =>
    formatPercent0(locale.value, totalPercent.value)
  )

  const currentNodePercent = computed(() =>
    clampPercentInt(
      Math.round((executionStore.executingNodeProgress ?? 0) * 100)
    )
  )

  const currentNodePercentFormatted = computed(() =>
    formatPercent0(locale.value, currentNodePercent.value)
  )

  return {
    totalPercent,
    totalPercentFormatted,
    currentNodePercent,
    currentNodePercentFormatted
  }
}
