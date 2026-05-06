import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

const EMPTY_EXPOSURES: readonly PreviewExposure[] = Object.freeze([])

/**
 * A resolved chain of preview exposures from a host node down to the originating
 * source preview.
 *
 * @remarks
 * PR-A skeleton type: this currently represents a single-link chain (the
 * direct exposure on the host). PR-B will expand this to model a full
 * walk through nested subgraph hosts so that an interior host's exposure
 * may resolve through one or more enclosing hosts to its ultimate source.
 */
export interface ResolvedPreviewChain {
  rootGraphId: UUID
  hostNodeLocator: string
  name: string
  source: {
    sourceNodeId: string
    sourcePreviewName: string
  }
}

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
   * Resolve the chain of exposures from a host down to the originating source preview.
   *
   * @remarks
   * PR-A stub: returns a single-link chain wrapping the direct exposure if it
   * exists on `(rootGraphId, hostNodeLocator)`, otherwise `undefined`. No nested
   * subgraph host walking is performed yet.
   *
   * TODO(PR-B): implement full nested-host chain walking so that when an
   * exposure's `sourceNodeId` itself refers to a subgraph host, this method
   * follows the named exposure on that interior host recursively until it
   * reaches a leaf (non-host) source.
   */
  function resolveChain(
    rootGraphId: UUID,
    hostNodeLocator: string,
    name: string
  ): ResolvedPreviewChain | undefined {
    const current = _getExposuresRef(rootGraphId, hostNodeLocator)
    const entry = current?.find((e) => e.name === name)
    if (!entry) return undefined
    return {
      rootGraphId,
      hostNodeLocator,
      name: entry.name,
      source: {
        sourceNodeId: entry.sourceNodeId,
        sourcePreviewName: entry.sourcePreviewName
      }
    }
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
