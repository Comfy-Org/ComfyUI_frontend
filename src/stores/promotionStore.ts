import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

const EMPTY_PROMOTIONS: PromotedWidgetSource[] = []

export function makePromotionEntryKey(source: PromotedWidgetSource): string {
  const base = `${source.sourceNodeId}:${source.sourceWidgetName}`
  return source.disambiguatingSourceNodeId
    ? `${base}:${source.disambiguatingSourceNodeId}`
    : base
}

export const usePromotionStore = defineStore('promotion', () => {
  const graphPromotions = ref(
    new Map<UUID, Map<NodeId, PromotedWidgetSource[]>>()
  )
  const graphRefCounts = ref(new Map<UUID, Map<string, number>>())

  function _getPromotionsForGraph(
    graphId: UUID
  ): Map<NodeId, PromotedWidgetSource[]> {
    const promotions = graphPromotions.value.get(graphId)
    if (promotions) return promotions

    const nextPromotions = new Map<NodeId, PromotedWidgetSource[]>()
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

  function _incrementKeys(
    graphId: UUID,
    entries: PromotedWidgetSource[]
  ): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      const key = makePromotionEntryKey(e)
      refCounts.set(key, (refCounts.get(key) ?? 0) + 1)
    }
  }

  function _decrementKeys(
    graphId: UUID,
    entries: PromotedWidgetSource[]
  ): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      const key = makePromotionEntryKey(e)
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
  ): PromotedWidgetSource[] {
    return (
      _getPromotionsForGraph(graphId).get(subgraphNodeId) ?? EMPTY_PROMOTIONS
    )
  }

  function getPromotions(
    graphId: UUID,
    subgraphNodeId: NodeId
  ): PromotedWidgetSource[] {
    return [...getPromotionsRef(graphId, subgraphNodeId)]
  }

  function isPromoted(
    graphId: UUID,
    subgraphNodeId: NodeId,
    source: PromotedWidgetSource
  ): boolean {
    return getPromotionsRef(graphId, subgraphNodeId).some(
      (e) =>
        e.sourceNodeId === source.sourceNodeId &&
        e.sourceWidgetName === source.sourceWidgetName &&
        e.disambiguatingSourceNodeId === source.disambiguatingSourceNodeId
    )
  }

  function isPromotedByAny(
    graphId: UUID,
    source: PromotedWidgetSource
  ): boolean {
    const refCounts = _getRefCountsForGraph(graphId)
    return (refCounts.get(makePromotionEntryKey(source)) ?? 0) > 0
  }

  function setPromotions(
    graphId: UUID,
    subgraphNodeId: NodeId,
    entries: PromotedWidgetSource[]
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
    source: PromotedWidgetSource
  ): void {
    if (isPromoted(graphId, subgraphNodeId, source)) return

    const entries = getPromotionsRef(graphId, subgraphNodeId)
    const entry: PromotedWidgetSource = {
      sourceNodeId: source.sourceNodeId,
      sourceWidgetName: source.sourceWidgetName
    }
    if (source.disambiguatingSourceNodeId)
      entry.disambiguatingSourceNodeId = source.disambiguatingSourceNodeId
    setPromotions(graphId, subgraphNodeId, [...entries, entry])
  }

  function demote(
    graphId: UUID,
    subgraphNodeId: NodeId,
    source: PromotedWidgetSource
  ): void {
    const entries = getPromotionsRef(graphId, subgraphNodeId)
    setPromotions(
      graphId,
      subgraphNodeId,
      entries.filter(
        (e) =>
          !(
            e.sourceNodeId === source.sourceNodeId &&
            e.sourceWidgetName === source.sourceWidgetName &&
            e.disambiguatingSourceNodeId === source.disambiguatingSourceNodeId
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

    promotions.set(subgraphNodeId, entries)
  }

  function clearGraph(graphId: UUID): void {
    graphPromotions.value.delete(graphId)
    graphRefCounts.value.delete(graphId)
  }

  /**
   * Checks whether a widget is promoted by any subgraph node in the given
   * graph. Handles nested subgraph promotions where the stored key may omit
   * the disambiguatingSourceNodeId — checks both key shapes (#10612).
   */
  function isWidgetPromoted(
    graphId: UUID,
    sourceNodeId: string,
    sourceWidgetName: string,
    disambiguatingSourceNodeId?: string
  ): boolean {
    if (
      disambiguatingSourceNodeId &&
      isPromotedByAny(graphId, {
        sourceNodeId,
        sourceWidgetName,
        disambiguatingSourceNodeId
      })
    )
      return true
    return isPromotedByAny(graphId, { sourceNodeId, sourceWidgetName })
  }

  return {
    getPromotionsRef,
    getPromotions,
    isPromoted,
    isPromotedByAny,
    isWidgetPromoted,
    setPromotions,
    promote,
    demote,
    movePromotion,
    clearGraph
  }
})
