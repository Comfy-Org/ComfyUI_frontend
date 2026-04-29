import { getActivePinia } from 'pinia'

import type { Pinia } from 'pinia'

import { usePromotionStore } from '@/stores/promotionStore'

let cachedPromotionStore: ReturnType<typeof usePromotionStore> | undefined
let cachedPinia: Pinia | undefined

function getPromotionStore() {
  const activePinia = getActivePinia()
  if (!cachedPromotionStore || cachedPinia !== activePinia) {
    cachedPromotionStore = usePromotionStore(activePinia)
    cachedPinia = activePinia
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
