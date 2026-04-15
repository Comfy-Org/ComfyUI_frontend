import { getActivePinia } from 'pinia'

import { usePromotionStore } from '@/stores/promotionStore'

let cachedPromotionStore: ReturnType<typeof usePromotionStore> | undefined

function getPromotionStore() {
  const activePinia = getActivePinia()
  if (!cachedPromotionStore || cachedPromotionStore.$pinia !== activePinia) {
    cachedPromotionStore = usePromotionStore()
  }
  return cachedPromotionStore
}

export function isWidgetPromoted(
  graphId: string,
  sourceNodeId: string,
  sourceWidgetName: string,
  disambiguatingSourceNodeId?: string
): boolean {
  return getPromotionStore().isWidgetPromoted(
    graphId,
    sourceNodeId,
    sourceWidgetName,
    disambiguatingSourceNodeId
  )
}
