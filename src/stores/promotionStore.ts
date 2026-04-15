import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

const EMPTY_PROMOTIONS: PromotedWidgetSource[] = []

function makePromotionBaseKey(source: PromotedWidgetSource): string {
  return `${source.sourceNodeId}:${source.sourceWidgetName}`
}

export function makePromotionEntryKey(source: PromotedWidgetSource): string {
  const base = makePromotionBaseKey(source)
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

  function _incrementKey(refCounts: Map<string, number>, key: string): void {
    refCounts.set(key, (refCounts.get(key) ?? 0) + 1)
  }

  function _decrementKey(refCounts: Map<string, number>, key: string): void {
    const current = refCounts.get(key)
    if (current === undefined) return

    if (current <= 1) {
      refCounts.delete(key)
    } else {
      refCounts.set(key, current - 1)
    }
  }

  function _incrementKeys(
    graphId: UUID,
    entries: PromotedWidgetSource[]
  ): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      _incrementKey(refCounts, makePromotionEntryKey(e))
      // Also index the base key so callers without a disambiguator can
      // still query whether any widget with this name is promoted.
      if (e.disambiguatingSourceNodeId) {
        _incrementKey(refCounts, makePromotionBaseKey(e))
      }
    }
  }

  function _decrementKeys(
    graphId: UUID,
    entries: PromotedWidgetSource[]
  ): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      _decrementKey(refCounts, makePromotionEntryKey(e))
      if (e.disambiguatingSourceNodeId) {
        _decrementKey(refCounts, makePromotionBaseKey(e))
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
   * graph. When disambiguatingSourceNodeId is provided, does an exact-key
   * lookup; otherwise falls back to a base-key lookup (which succeeds if
   * any widget with that name on the source node is promoted).
   */
  function isWidgetPromoted(
    graphId: UUID,
    sourceNodeId: string,
    sourceWidgetName: string,
    disambiguatingSourceNodeId?: string
  ): boolean {
    return isPromotedByAny(graphId, {
      sourceNodeId,
      sourceWidgetName,
      ...(disambiguatingSourceNodeId && { disambiguatingSourceNodeId })
    })
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
