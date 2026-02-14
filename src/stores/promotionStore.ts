import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'

interface PromotionEntry {
  interiorNodeId: string
  widgetName: string
}

export const usePromotionStore = defineStore('promotion', () => {
  const promotions = ref(new Map<NodeId, PromotionEntry[]>())

  const allPromotedKeys = computed(
    () =>
      new Set(
        [...promotions.value.values()].flatMap((entries) =>
          entries.map((e) => `${e.interiorNodeId}:${e.widgetName}`)
        )
      )
  )

  function getPromotions(subgraphNodeId: NodeId): PromotionEntry[] {
    return promotions.value.get(subgraphNodeId) ?? []
  }

  function isPromoted(
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string
  ): boolean {
    return getPromotions(subgraphNodeId).some(
      (e) => e.interiorNodeId === interiorNodeId && e.widgetName === widgetName
    )
  }

  function isPromotedByAny(
    interiorNodeId: string,
    widgetName: string
  ): boolean {
    return allPromotedKeys.value.has(`${interiorNodeId}:${widgetName}`)
  }

  function setPromotions(
    subgraphNodeId: NodeId,
    entries: PromotionEntry[]
  ): void {
    if (entries.length === 0) {
      promotions.value.delete(subgraphNodeId)
    } else {
      promotions.value.set(subgraphNodeId, [...entries])
    }
  }

  function promote(
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string
  ): void {
    if (isPromoted(subgraphNodeId, interiorNodeId, widgetName)) return
    const entries = getPromotions(subgraphNodeId)
    setPromotions(subgraphNodeId, [...entries, { interiorNodeId, widgetName }])
  }

  function demote(
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string
  ): void {
    const entries = getPromotions(subgraphNodeId)
    setPromotions(
      subgraphNodeId,
      entries.filter(
        (e) =>
          !(e.interiorNodeId === interiorNodeId && e.widgetName === widgetName)
      )
    )
  }

  function movePromotion(
    subgraphNodeId: NodeId,
    fromIndex: number,
    toIndex: number
  ): void {
    const entries = [...getPromotions(subgraphNodeId)]
    if (
      fromIndex < 0 ||
      fromIndex >= entries.length ||
      toIndex < 0 ||
      toIndex >= entries.length
    )
      return
    const [entry] = entries.splice(fromIndex, 1)
    entries.splice(toIndex, 0, entry)
    setPromotions(subgraphNodeId, entries)
  }

  return {
    getPromotions,
    isPromoted,
    isPromotedByAny,
    setPromotions,
    promote,
    demote,
    movePromotion
  }
})
