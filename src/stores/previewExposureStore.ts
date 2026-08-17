import { defineStore } from 'pinia'
import { ref } from 'vue'

import type {
  PreviewExposureChainContext,
  ResolvedPreviewChain
} from '@/core/graph/subgraph/preview/previewExposureChain'
import { resolvePreviewExposureChain } from '@/core/graph/subgraph/preview/previewExposureChain'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import { toNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

const EMPTY_EXPOSURES: readonly PreviewExposure[] = Object.freeze([])
const EMPTY_SUPPRESSED_IDS: ReadonlySet<NodeId> = new Set()

type ResolveNestedHostFn = NonNullable<
  PreviewExposureChainContext['resolveNestedHost']
>

type PreviewExposureInput = Omit<PreviewExposure, 'sourceNodeId'> & {
  sourceNodeId: SerializedNodeId
}

function normalizePreviewExposure(
  exposure: PreviewExposureInput
): PreviewExposure {
  return {
    ...exposure,
    sourceNodeId: toNodeId(exposure.sourceNodeId)
  }
}

export const usePreviewExposureStore = defineStore('previewExposure', () => {
  const exposures = ref(new Map<UUID, Map<string, PreviewExposure[]>>())
  /**
   * Tombstones for ambient-preview suppression: nodes whose exposure was
   * explicitly removed, so `useAmbientSubgraphPreviews` can tell "removed by
   * the user" apart from "never promoted" and keep it hidden even though the
   * node is still producing live output.
   */
  const suppressedAmbientNodeIds = ref(
    new Map<UUID, Map<string, Set<NodeId>>>()
  )

  function _getHostsForGraph(
    rootGraphId: UUID
  ): Map<string, PreviewExposure[]> {
    const hosts = exposures.value.get(rootGraphId)
    if (hosts) return hosts

    const nextHosts = new Map<string, PreviewExposure[]>()
    exposures.value.set(rootGraphId, nextHosts)
    return nextHosts
  }

  function _getSuppressedHostsForGraph(
    rootGraphId: UUID
  ): Map<string, Set<NodeId>> {
    const hosts = suppressedAmbientNodeIds.value.get(rootGraphId)
    if (hosts) return hosts

    const nextHosts = new Map<string, Set<NodeId>>()
    suppressedAmbientNodeIds.value.set(rootGraphId, nextHosts)
    return nextHosts
  }

  function getSuppressedAmbientNodeIds(
    rootGraphId: UUID,
    hostNodeLocator: string
  ): ReadonlySet<NodeId> {
    return (
      suppressedAmbientNodeIds.value.get(rootGraphId)?.get(hostNodeLocator) ??
      EMPTY_SUPPRESSED_IDS
    )
  }

  function _suppressAmbientPreview(
    rootGraphId: UUID,
    hostNodeLocator: string,
    sourceNodeId: NodeId
  ): void {
    const hosts = _getSuppressedHostsForGraph(rootGraphId)
    const existing = hosts.get(hostNodeLocator)
    if (existing) {
      existing.add(sourceNodeId)
    } else {
      hosts.set(hostNodeLocator, new Set([sourceNodeId]))
    }
  }

  function _unsuppressAmbientPreview(
    rootGraphId: UUID,
    hostNodeLocator: string,
    sourceNodeId: NodeId
  ): void {
    suppressedAmbientNodeIds.value
      .get(rootGraphId)
      ?.get(hostNodeLocator)
      ?.delete(sourceNodeId)
  }

  function _getExposuresRef(
    rootGraphId: UUID,
    hostNodeLocator: string
  ): PreviewExposure[] | undefined {
    return exposures.value.get(rootGraphId)?.get(hostNodeLocator)
  }

  function getExposures(
    rootGraphId: UUID,
    hostNodeLocator: string
  ): readonly PreviewExposure[] {
    return _getExposuresRef(rootGraphId, hostNodeLocator) ?? EMPTY_EXPOSURES
  }

  function setExposures(
    rootGraphId: UUID,
    hostNodeLocator: string,
    next: readonly PreviewExposureInput[]
  ): void {
    const hosts = _getHostsForGraph(rootGraphId)
    if (next.length === 0) {
      hosts.delete(hostNodeLocator)
      if (hosts.size === 0) exposures.value.delete(rootGraphId)
      return
    }
    hosts.set(hostNodeLocator, next.map(normalizePreviewExposure))
  }

  function addExposure(
    rootGraphId: UUID,
    hostNodeLocator: string,
    source: { sourceNodeId: SerializedNodeId; sourcePreviewName: string }
  ): PreviewExposure {
    const hosts = _getHostsForGraph(rootGraphId)
    const current = hosts.get(hostNodeLocator) ?? []
    const existingNames = current.map((e) => e.name)
    const name = nextUniqueName(source.sourcePreviewName, existingNames)
    const entry: PreviewExposure = {
      name,
      sourceNodeId: toNodeId(source.sourceNodeId),
      sourcePreviewName: source.sourcePreviewName
    }
    hosts.set(hostNodeLocator, [...current, entry])
    _unsuppressAmbientPreview(rootGraphId, hostNodeLocator, entry.sourceNodeId)
    return entry
  }

  function removeExposure(
    rootGraphId: UUID,
    hostNodeLocator: string,
    name: string
  ): void {
    const current = _getExposuresRef(rootGraphId, hostNodeLocator)
    if (!current?.length) return
    const removed = current.find((e) => e.name === name)
    const next = current.filter((e) => e.name !== name)
    if (next.length === current.length) return
    setExposures(rootGraphId, hostNodeLocator, next)
    if (removed) {
      _suppressAmbientPreview(
        rootGraphId,
        hostNodeLocator,
        removed.sourceNodeId
      )
    }
  }

  function clearGraph(rootGraphId: UUID): void {
    exposures.value.delete(rootGraphId)
    suppressedAmbientNodeIds.value.delete(rootGraphId)
  }

  function getExposuresAsPromotionShape(
    rootGraphId: UUID,
    hostNodeLocator: string
  ): PromotedWidgetSource[] {
    return getExposures(rootGraphId, hostNodeLocator).map((exposure) => ({
      sourceNodeId: exposure.sourceNodeId,
      sourceWidgetName: exposure.sourcePreviewName
    }))
  }

  /**
   * @param resolveNestedHost If provided, recurses through nested SubgraphNode
   * boundaries; otherwise the chain is a single-step walk on the starting host.
   */
  function resolveChain(
    rootGraphId: UUID,
    hostNodeLocator: string,
    name: string,
    resolveNestedHost?: ResolveNestedHostFn
  ): ResolvedPreviewChain | undefined {
    const ctx: PreviewExposureChainContext = {
      getExposures,
      resolveNestedHost: resolveNestedHost ?? (() => undefined)
    }
    return resolvePreviewExposureChain(rootGraphId, hostNodeLocator, name, ctx)
  }

  return {
    getExposures,
    getExposuresAsPromotionShape,
    getSuppressedAmbientNodeIds,
    setExposures,
    addExposure,
    removeExposure,
    clearGraph,
    resolveChain
  }
})
