import { defineStore } from 'pinia'
import { ref, triggerRef } from 'vue'

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
  // Non-reactive: ephemeral position cache consumed only by promote/demote
  const lastDemotedIndices = new Map<UUID, Map<string, number>>()

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
    triggerRef(graphPromotions)
  }

  function _positionKey(
    subgraphNodeId: NodeId,
    source: PromotedWidgetSource
  ): string {
    return `${subgraphNodeId}:${makePromotionEntryKey(source)}`
  }

  function _getLastDemotedForGraph(graphId: UUID): Map<string, number> {
    const existing = lastDemotedIndices.get(graphId)
    if (existing) return existing
    const next = new Map<string, number>()
    lastDemotedIndices.set(graphId, next)
    return next
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

    const positionKey = _positionKey(subgraphNodeId, source)
    const graphCache = lastDemotedIndices.get(graphId)
    const lastIndex = graphCache?.get(positionKey)
    graphCache?.delete(positionKey)

    const nextEntries = [...entries]
    if (lastIndex !== undefined) {
      const insertAt = Math.min(lastIndex, nextEntries.length)
      nextEntries.splice(insertAt, 0, entry)
    } else {
      nextEntries.push(entry)
    }
    setPromotions(graphId, subgraphNodeId, nextEntries)
  }

  function demote(
    graphId: UUID,
    subgraphNodeId: NodeId,
    source: PromotedWidgetSource
  ): void {
    const entries = getPromotionsRef(graphId, subgraphNodeId)
    const index = entries.findIndex(
      (e) =>
        e.sourceNodeId === source.sourceNodeId &&
        e.sourceWidgetName === source.sourceWidgetName &&
        e.disambiguatingSourceNodeId === source.disambiguatingSourceNodeId
    )
    if (index === -1) return

    _getLastDemotedForGraph(graphId).set(
      _positionKey(subgraphNodeId, source),
      index
    )
    setPromotions(
      graphId,
      subgraphNodeId,
      entries.filter((_, i) => i !== index)
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
    lastDemotedIndices.delete(graphId)
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
