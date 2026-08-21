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
import type { SerializedNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

const EMPTY_EXPOSURES: readonly PreviewExposure[] = Object.freeze([])

type ResolveNestedHostFn = NonNullable<
  PreviewExposureChainContext['resolveNestedHost']
>

type PreviewExposureInput = Omit<PreviewExposure, 'sourceNodeId'> & {
  sourceNodeId: SerializedNodeId
}

type ExposureSource = {
  sourceNodeId: SerializedNodeId
  sourcePreviewName: string
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

  function _getHostsForGraph(
    rootGraphId: UUID
  ): Map<string, PreviewExposure[]> {
    const hosts = exposures.value.get(rootGraphId)
    if (hosts) return hosts

    const nextHosts = new Map<string, PreviewExposure[]>()
    exposures.value.set(rootGraphId, nextHosts)
    return nextHosts
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

  function findExposure(
    rootGraphId: UUID,
    hostNodeLocator: string,
    source: ExposureSource
  ): PreviewExposure | undefined {
    const sourceNodeId = toNodeId(source.sourceNodeId)
    return _getExposuresRef(rootGraphId, hostNodeLocator)?.find(
      (entry) =>
        entry.sourceNodeId === sourceNodeId &&
        entry.sourcePreviewName === source.sourcePreviewName
    )
  }

  function hasExposure(
    rootGraphId: UUID,
    hostNodeLocator: string,
    source: ExposureSource
  ): boolean {
    return findExposure(rootGraphId, hostNodeLocator, source) !== undefined
  }

  function addExposure(
    rootGraphId: UUID,
    hostNodeLocator: string,
    source: ExposureSource
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
    return entry
  }

  function removeExposure(
    rootGraphId: UUID,
    hostNodeLocator: string,
    name: string
  ): void {
    const current = _getExposuresRef(rootGraphId, hostNodeLocator)
    if (!current?.length) return
    const next = current.filter((e) => e.name !== name)
    if (next.length === current.length) return
    setExposures(rootGraphId, hostNodeLocator, next)
  }

  function clearGraph(rootGraphId: UUID): void {
    exposures.value.delete(rootGraphId)
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
    findExposure,
    hasExposure,
    setExposures,
    addExposure,
    removeExposure,
    clearGraph,
    resolveChain
  }
})
