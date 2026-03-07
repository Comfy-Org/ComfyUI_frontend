import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

interface PromotionEntry {
  interiorNodeId: string
  widgetName: string
}

export const usePromotionStore = defineStore('promotion', () => {
  const graphPromotions = ref(new Map<UUID, Map<NodeId, PromotionEntry[]>>())
  const graphRefCounts = ref(new Map<UUID, Map<string, number>>())

  /**
   * Monotonic counter incremented on every mutation. Dependents read this
   * inside their computed/watch to guarantee re-evaluation even when the
   * nested Map proxies don't propagate change notifications reliably.
   */
  const _version = ref(0)
  function _touch() {
    _version.value++
  }

  function _getPromotionsForGraph(
    graphId: UUID
  ): Map<NodeId, PromotionEntry[]> {
    let promotions = graphPromotions.value.get(graphId)
    if (promotions) return promotions

    graphPromotions.value.set(graphId, new Map<NodeId, PromotionEntry[]>())
    // Re-read through the reactive proxy so callers get the tracked version
    promotions = graphPromotions.value.get(graphId)!
    return promotions
  }

  function _getRefCountsForGraph(graphId: UUID): Map<string, number> {
    let refCounts = graphRefCounts.value.get(graphId)
    if (refCounts) return refCounts

    graphRefCounts.value.set(graphId, new Map<string, number>())
    refCounts = graphRefCounts.value.get(graphId)!
    return refCounts
  }

  function _makeKey(interiorNodeId: string, widgetName: string): string {
    return `${interiorNodeId}:${widgetName}`
  }

  function _incrementKeys(graphId: UUID, entries: PromotionEntry[]): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      const key = _makeKey(e.interiorNodeId, e.widgetName)
      refCounts.set(key, (refCounts.get(key) ?? 0) + 1)
    }
  }

  function _decrementKeys(graphId: UUID, entries: PromotionEntry[]): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      const key = _makeKey(e.interiorNodeId, e.widgetName)
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
    // Read version to establish reactive dependency
    void _version.value
    return _getPromotionsForGraph(graphId).get(subgraphNodeId) ?? []
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
    widgetName: string
  ): boolean {
    return getPromotionsRef(graphId, subgraphNodeId).some(
      (e) => e.interiorNodeId === interiorNodeId && e.widgetName === widgetName
    )
  }

  function isPromotedByAny(
    graphId: UUID,
    interiorNodeId: string,
    widgetName: string
  ): boolean {
    const refCounts = _getRefCountsForGraph(graphId)
    return (refCounts.get(_makeKey(interiorNodeId, widgetName)) ?? 0) > 0
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
    _touch()
  }

  function promote(
    graphId: UUID,
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string
  ): void {
    if (isPromoted(graphId, subgraphNodeId, interiorNodeId, widgetName)) return
    const entries = getPromotionsRef(graphId, subgraphNodeId)
    setPromotions(graphId, subgraphNodeId, [
      ...entries,
      { interiorNodeId, widgetName }
    ])
  }

  function demote(
    graphId: UUID,
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string
  ): void {
    const entries = getPromotionsRef(graphId, subgraphNodeId)
    setPromotions(
      graphId,
      subgraphNodeId,
      entries.filter(
        (e) =>
          !(e.interiorNodeId === interiorNodeId && e.widgetName === widgetName)
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
    _touch()
  }

  function clearGraph(graphId: UUID): void {
    graphPromotions.value.delete(graphId)
    graphRefCounts.value.delete(graphId)
    _touch()
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
