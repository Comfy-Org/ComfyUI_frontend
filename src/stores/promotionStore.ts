import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'

interface PromotionEntry {
  interiorNodeId: string
  widgetName: string
}

export const usePromotionStore = defineStore('promotion', () => {
  const promotions = ref(new Map<NodeId, PromotionEntry[]>())
  const _refCounts = ref(new Map<string, number>())

  function _makeKey(interiorNodeId: string, widgetName: string): string {
    return `${interiorNodeId}:${widgetName}`
  }

  function _incrementKeys(entries: PromotionEntry[]): void {
    for (const e of entries) {
      const key = _makeKey(e.interiorNodeId, e.widgetName)
      _refCounts.value.set(key, (_refCounts.value.get(key) ?? 0) + 1)
    }
  }

  function _decrementKeys(entries: PromotionEntry[]): void {
    for (const e of entries) {
      const key = _makeKey(e.interiorNodeId, e.widgetName)
      const count = (_refCounts.value.get(key) ?? 1) - 1
      if (count <= 0) {
        _refCounts.value.delete(key)
      } else {
        _refCounts.value.set(key, count)
      }
    }
  }

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
    return (_refCounts.value.get(_makeKey(interiorNodeId, widgetName)) ?? 0) > 0
  }

  function setPromotions(
    subgraphNodeId: NodeId,
    entries: PromotionEntry[]
  ): void {
    const oldEntries = promotions.value.get(subgraphNodeId) ?? []
    _decrementKeys(oldEntries)
    _incrementKeys(entries)

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
