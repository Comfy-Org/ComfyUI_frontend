import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { PreviewExposureChainContext } from '@/core/graph/subgraph/preview/previewExposureChain'
import { resolvePreviewExposureChain } from '@/core/graph/subgraph/preview/previewExposureChain'
import type { ResolvedPreviewChain } from '@/core/graph/subgraph/preview/previewExposureTypes'
import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

const EMPTY_EXPOSURES: readonly PreviewExposure[] = Object.freeze([])

export type { ResolvedPreviewChain } from '@/core/graph/subgraph/preview/previewExposureTypes'

/**
 * Optional resolver passed by callers that want {@link resolveChain} to walk
 * nested subgraph host boundaries.
 *
 * Given a `(rootGraphId, hostNodeLocator, sourceNodeId)` triple, return the
 * `(rootGraphId, hostNodeLocator)` of the inner host SubgraphNode the source
 * resolves to, or `undefined` for non-host (leaf) sources.
 */
export type ResolveNestedHostFn = NonNullable<
  PreviewExposureChainContext['resolveNestedHost']
>

export const usePreviewExposureStore = defineStore('previewExposure', () => {
  // Keyed by (rootGraphId, hostNodeLocator).
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
    next: readonly PreviewExposure[]
  ): void {
    const hosts = _getHostsForGraph(rootGraphId)
    if (next.length === 0) {
      hosts.delete(hostNodeLocator)
      if (hosts.size === 0) exposures.value.delete(rootGraphId)
      return
    }
    hosts.set(hostNodeLocator, [...next])
  }

  function addExposure(
    rootGraphId: UUID,
    hostNodeLocator: string,
    source: { sourceNodeId: string; sourcePreviewName: string }
  ): PreviewExposure {
    const hosts = _getHostsForGraph(rootGraphId)
    const current = hosts.get(hostNodeLocator) ?? []
    const existingNames = current.map((e) => e.name)
    const name = nextUniqueName(source.sourcePreviewName, existingNames)
    const entry: PreviewExposure = {
      name,
      sourceNodeId: source.sourceNodeId,
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

  function moveExposure(
    rootGraphId: UUID,
    hostNodeLocator: string,
    fromIndex: number,
    toIndex: number
  ): void {
    const hosts = exposures.value.get(rootGraphId)
    const current = hosts?.get(hostNodeLocator)
    if (!hosts || !current?.length) return

    if (
      fromIndex < 0 ||
      fromIndex >= current.length ||
      toIndex < 0 ||
      toIndex >= current.length ||
      fromIndex === toIndex
    )
      return

    const next = [...current]
    const [entry] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, entry)
    hosts.set(hostNodeLocator, next)
  }

  function clearGraph(rootGraphId: UUID): void {
    exposures.value.delete(rootGraphId)
  }

  /**
   * Resolve the chain of exposures from a host down to the originating source
   * preview, optionally walking through nested subgraph hosts.
   *
   * @param resolveNestedHost If provided, the walker recurses through nested
   * SubgraphNode boundaries by calling this resolver. Without it, the chain is
   * a single-step walk on the starting host.
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
    setExposures,
    addExposure,
    removeExposure,
    moveExposure,
    clearGraph,
    resolveChain
  }
})
