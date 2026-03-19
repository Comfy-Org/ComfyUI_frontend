import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

interface PromotionEntry {
  interiorNodeId: string
  widgetName: string
  sourceNodeId?: string
}

const EMPTY_PROMOTIONS: PromotionEntry[] = []

export function makePromotionEntryKey(
  interiorNodeId: string,
  widgetName: string,
  sourceNodeId?: string
): string {
  const base = `${interiorNodeId}:${widgetName}`
  return sourceNodeId ? `${base}:${sourceNodeId}` : base
}

export const usePromotionStore = defineStore('promotion', () => {
  const graphPromotions = ref(new Map<UUID, Map<NodeId, PromotionEntry[]>>())
  const graphRefCounts = ref(new Map<UUID, Map<string, number>>())

  function _getPromotionsForGraph(
    graphId: UUID
  ): Map<NodeId, PromotionEntry[]> {
    const promotions = graphPromotions.value.get(graphId)
    if (promotions) return promotions

    const nextPromotions = new Map<NodeId, PromotionEntry[]>()
    graphPromotions.value.set(graphId, nextPromotions)
    return nextPromotions
  }

  function _getRefCountsForGraph(graphId: UUID): Map<string, number> {
    const refCounts = graphRefCounts.value.get(graphId)
    if (refCounts) return refCounts

    const nextRefCounts = new Map<string, number>()
    graphRefCounts.value.set(graphId, nextRefCounts)
    return nextRefCounts
  }

  function _incrementKeys(graphId: UUID, entries: PromotionEntry[]): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      const key = makePromotionEntryKey(
        e.interiorNodeId,
        e.widgetName,
        e.sourceNodeId
      )
      refCounts.set(key, (refCounts.get(key) ?? 0) + 1)
    }
  }

  function _decrementKeys(graphId: UUID, entries: PromotionEntry[]): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      const key = makePromotionEntryKey(
        e.interiorNodeId,
        e.widgetName,
        e.sourceNodeId
      )
      const count = (refCounts.get(key) ?? 1) - 1
      if (count <= 0) {
        refCounts.delete(key)
      } else {
        refCounts.set(key, count)
      }
    }
  }

  function getPromotionsRef(
    graphId: UUID,
    subgraphNodeId: NodeId
  ): PromotionEntry[] {
    return (
      _getPromotionsForGraph(graphId).get(subgraphNodeId) ?? EMPTY_PROMOTIONS
    )
  }

  function getPromotions(
    graphId: UUID,
    subgraphNodeId: NodeId
  ): PromotionEntry[] {
    return [...getPromotionsRef(graphId, subgraphNodeId)]
  }

  function isPromoted(
    graphId: UUID,
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string,
    sourceNodeId?: string
  ): boolean {
    return getPromotionsRef(graphId, subgraphNodeId).some(
      (e) =>
        e.interiorNodeId === interiorNodeId &&
        e.widgetName === widgetName &&
        e.sourceNodeId === sourceNodeId
    )
  }

  function isPromotedByAny(
    graphId: UUID,
    interiorNodeId: string,
    widgetName: string,
    sourceNodeId?: string
  ): boolean {
    const refCounts = _getRefCountsForGraph(graphId)
    return (
      (refCounts.get(
        makePromotionEntryKey(interiorNodeId, widgetName, sourceNodeId)
      ) ?? 0) > 0
    )
  }

  function setPromotions(
    graphId: UUID,
    subgraphNodeId: NodeId,
    entries: PromotionEntry[]
  ): void {
    const promotions = _getPromotionsForGraph(graphId)
    const oldEntries = promotions.get(subgraphNodeId) ?? []

    _decrementKeys(graphId, oldEntries)
    _incrementKeys(graphId, entries)

    if (entries.length === 0) {
      promotions.delete(subgraphNodeId)
    } else {
      promotions.set(subgraphNodeId, [...entries])
    }
  }

  function promote(
    graphId: UUID,
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string,
    sourceNodeId?: string
  ): void {
    if (
      isPromoted(
        graphId,
        subgraphNodeId,
        interiorNodeId,
        widgetName,
        sourceNodeId
      )
    )
      return

    const entries = getPromotionsRef(graphId, subgraphNodeId)
    const entry: PromotionEntry = { interiorNodeId, widgetName }
    if (sourceNodeId) entry.sourceNodeId = sourceNodeId
    setPromotions(graphId, subgraphNodeId, [...entries, entry])
  }

  function demote(
    graphId: UUID,
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string,
    sourceNodeId?: string
  ): void {
    const entries = getPromotionsRef(graphId, subgraphNodeId)
    setPromotions(
      graphId,
      subgraphNodeId,
      entries.filter(
        (e) =>
          !(
            e.interiorNodeId === interiorNodeId &&
            e.widgetName === widgetName &&
            e.sourceNodeId === sourceNodeId
          )
      )
    )
  }

  function movePromotion(
    graphId: UUID,
    subgraphNodeId: NodeId,
    fromIndex: number,
    toIndex: number
  ): void {
    const promotions = _getPromotionsForGraph(graphId)
    const currentEntries = promotions.get(subgraphNodeId)
    if (!currentEntries?.length) return

    const entries = [...currentEntries]
    if (
      fromIndex < 0 ||
      fromIndex >= entries.length ||
      toIndex < 0 ||
      toIndex >= entries.length ||
      fromIndex === toIndex
    )
      return

    const [entry] = entries.splice(fromIndex, 1)
    entries.splice(toIndex, 0, entry)

    // Reordering does not change membership, so ref-counts remain valid.
    promotions.set(subgraphNodeId, entries)
  }

  function clearGraph(graphId: UUID): void {
    graphPromotions.value.delete(graphId)
    graphRefCounts.value.delete(graphId)
  }

  return {
    getPromotionsRef,
    getPromotions,
    isPromoted,
    isPromotedByAny,
    setPromotions,
    promote,
    demote,
    movePromotion,
    clearGraph
  }
})
