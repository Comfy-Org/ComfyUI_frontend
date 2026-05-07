import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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

/**
 * Runtime PromotionStore.
 *
 * After ADR 0009 the canonical owner of a promoted value widget is the linked
 * `SubgraphInput` itself (and the host's `_widget` slot). This store no
 * longer owns serialized state — it is a runtime index used by callers that
 * key off `(rootGraphId, subgraphNodeId)`.
 *
 * The internal map is rebuilt by `setPromotions(...)` from current host
 * inputs by the PromotionStore's only writer, `_internalConfigureAfterSlots`,
 * and by the slice 5 migration flush. `isPromotedByAny` is a derived
 * `computed` over all entries in a graph; it has no separate ref-count
 * store.
 */
export const usePromotionStore = defineStore('promotion', () => {
  const graphPromotions = ref(
    new Map<UUID, Map<NodeId, PromotedWidgetSource[]>>()
  )

  function _getPromotionsForGraph(
    graphId: UUID
  ): Map<NodeId, PromotedWidgetSource[]> {
    const promotions = graphPromotions.value.get(graphId)
    if (promotions) return promotions

    const nextPromotions = new Map<NodeId, PromotedWidgetSource[]>()
    graphPromotions.value.set(graphId, nextPromotions)
    return nextPromotions
  }

  /** Derived: keys-by-graph of all promotion entry keys (any subgraph node). */
  const allKeysByGraph = computed(() => {
    const result = new Map<UUID, Set<string>>()
    for (const [graphId, hosts] of graphPromotions.value) {
      const keys = new Set<string>()
      for (const entries of hosts.values()) {
        for (const entry of entries) keys.add(makePromotionEntryKey(entry))
      }
      result.set(graphId, keys)
    }
    return result
  })

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
    const keys = allKeysByGraph.value.get(graphId)
    return keys?.has(makePromotionEntryKey(source)) ?? false
  }

  function setPromotions(
    graphId: UUID,
    subgraphNodeId: NodeId,
    entries: PromotedWidgetSource[]
  ): void {
    const promotions = _getPromotionsForGraph(graphId)

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
