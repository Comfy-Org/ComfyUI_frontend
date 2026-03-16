import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

interface PromotionEntry {
  interiorNodeId: string
  widgetName: string
}

interface ManifestEntry extends PromotionEntry {
  promoted: boolean
}

const EMPTY_PROMOTIONS: PromotionEntry[] = []
const EMPTY_MANIFEST: readonly ManifestEntry[] = []

export const usePromotionStore = defineStore('promotion', () => {
  const graphManifests = ref(new Map<UUID, Map<NodeId, ManifestEntry[]>>())
  const graphRefCounts = ref(new Map<UUID, Map<string, number>>())
  const promotedCache = new WeakMap<ManifestEntry[], PromotionEntry[]>()

  function _getManifestForGraph(graphId: UUID): Map<NodeId, ManifestEntry[]> {
    const manifests = graphManifests.value.get(graphId)
    if (manifests) return manifests

    const nextManifests = new Map<NodeId, ManifestEntry[]>()
    graphManifests.value.set(graphId, nextManifests)
    return nextManifests
  }

  function _getRefCountsForGraph(graphId: UUID): Map<string, number> {
    const refCounts = graphRefCounts.value.get(graphId)
    if (refCounts) return refCounts

    const nextRefCounts = new Map<string, number>()
    graphRefCounts.value.set(graphId, nextRefCounts)
    return nextRefCounts
  }

  function _makeKey(interiorNodeId: string, widgetName: string): string {
    return `${interiorNodeId}:${widgetName}`
  }

  function _matchesEntry(
    e: PromotionEntry,
    interiorNodeId: string,
    widgetName: string
  ): boolean {
    return e.interiorNodeId === interiorNodeId && e.widgetName === widgetName
  }

  function _getPromotedEntries(manifest: ManifestEntry[]): PromotionEntry[] {
    const cached = promotedCache.get(manifest)
    if (cached) return cached

    const promoted = manifest
      .filter((e) => e.promoted)
      .map(({ interiorNodeId, widgetName }) => ({
        interiorNodeId,
        widgetName
      }))

    promotedCache.set(manifest, promoted)
    return promoted
  }

  function _incrementKeys(
    graphId: UUID,
    entries: readonly PromotionEntry[]
  ): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      const key = _makeKey(e.interiorNodeId, e.widgetName)
      refCounts.set(key, (refCounts.get(key) ?? 0) + 1)
    }
  }

  function _decrementKeys(
    graphId: UUID,
    entries: readonly PromotionEntry[]
  ): void {
    const refCounts = _getRefCountsForGraph(graphId)
    for (const e of entries) {
      const key = _makeKey(e.interiorNodeId, e.widgetName)
      const count = (refCounts.get(key) ?? 1) - 1
      if (count <= 0) refCounts.delete(key)
      else refCounts.set(key, count)
    }
  }

  function _commitManifest(
    graphId: UUID,
    subgraphNodeId: NodeId,
    nextManifest: ManifestEntry[]
  ): void {
    const manifests = _getManifestForGraph(graphId)
    const prevManifest = manifests.get(subgraphNodeId) ?? EMPTY_MANIFEST

    if (prevManifest === nextManifest) return

    _decrementKeys(graphId, _getPromotedEntries([...prevManifest]))
    _incrementKeys(graphId, _getPromotedEntries(nextManifest))

    if (nextManifest.length === 0) manifests.delete(subgraphNodeId)
    else manifests.set(subgraphNodeId, nextManifest)
  }

  function _updateManifest(
    graphId: UUID,
    subgraphNodeId: NodeId,
    updater: (manifest: readonly ManifestEntry[]) => ManifestEntry[]
  ): void {
    const manifests = _getManifestForGraph(graphId)
    const prevManifest = manifests.get(subgraphNodeId) ?? EMPTY_MANIFEST
    _commitManifest(graphId, subgraphNodeId, updater(prevManifest))
  }

  function getPromotionsRef(
    graphId: UUID,
    subgraphNodeId: NodeId
  ): PromotionEntry[] {
    const manifest = _getManifestForGraph(graphId).get(subgraphNodeId)
    return manifest ? _getPromotedEntries(manifest) : EMPTY_PROMOTIONS
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
    const manifest = _getManifestForGraph(graphId).get(subgraphNodeId)
    if (!manifest) return false
    return manifest.some(
      (e) => e.promoted && _matchesEntry(e, interiorNodeId, widgetName)
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
    _commitManifest(
      graphId,
      subgraphNodeId,
      entries.map((e) => ({ ...e, promoted: true }))
    )
  }

  function promote(
    graphId: UUID,
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string
  ): void {
    _updateManifest(graphId, subgraphNodeId, (manifest) => {
      const index = manifest.findIndex((e) =>
        _matchesEntry(e, interiorNodeId, widgetName)
      )

      if (index === -1)
        return [...manifest, { interiorNodeId, widgetName, promoted: true }]

      if (manifest[index].promoted) return manifest as ManifestEntry[]

      const next = [...manifest]
      next[index] = { ...next[index], promoted: true }
      return next
    })
  }

  function demote(
    graphId: UUID,
    subgraphNodeId: NodeId,
    interiorNodeId: string,
    widgetName: string
  ): void {
    _updateManifest(graphId, subgraphNodeId, (manifest) => {
      const index = manifest.findIndex(
        (e) => e.promoted && _matchesEntry(e, interiorNodeId, widgetName)
      )

      if (index === -1) return manifest as ManifestEntry[]

      const next = [...manifest]
      next[index] = { ...next[index], promoted: false }
      return next
    })
  }

  function movePromotion(
    graphId: UUID,
    subgraphNodeId: NodeId,
    fromIndex: number,
    toIndex: number
  ): void {
    _updateManifest(graphId, subgraphNodeId, (manifest) => {
      const promotedIndices: number[] = []
      for (let i = 0; i < manifest.length; i++) {
        if (manifest[i].promoted) promotedIndices.push(i)
      }

      if (
        fromIndex < 0 ||
        fromIndex >= promotedIndices.length ||
        toIndex < 0 ||
        toIndex >= promotedIndices.length ||
        fromIndex === toIndex
      )
        return manifest as ManifestEntry[]

      const promotedEntries = promotedIndices.map((i) => manifest[i])
      const [moved] = promotedEntries.splice(fromIndex, 1)
      promotedEntries.splice(toIndex, 0, moved)

      const next = [...manifest]
      promotedIndices.forEach((manifestIndex, i) => {
        next[manifestIndex] = promotedEntries[i]
      })
      return next
    })
  }

  function clearGraph(graphId: UUID): void {
    graphManifests.value.delete(graphId)
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
