import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

import type { LGraphConfig, LGraphExtra } from '@/lib/litegraph/src/LGraph'
import type { UUID } from '@/utils/uuid'

interface GraphMetadata {
  revision: number
  config: LGraphConfig
  extra: LGraphExtra
}

export const useGraphMetadataStore = defineStore('graphMetadata', () => {
  const metadataByRoot = shallowReactive(
    new Map<UUID, Map<UUID, GraphMetadata>>()
  )

  function get(rootGraphId: UUID, graphId: UUID = rootGraphId): GraphMetadata {
    let metadata = metadataByRoot.get(rootGraphId)
    if (!metadata) {
      metadata = shallowReactive(new Map())
      metadataByRoot.set(rootGraphId, metadata)
    }
    const existing = metadata.get(graphId)
    if (existing) return existing

    const created = shallowReactive<GraphMetadata>({
      revision: 0,
      config: {},
      extra: {}
    })
    metadata.set(graphId, created)
    return created
  }

  function rekeyRoot(previousId: UUID, nextId: UUID): void {
    if (previousId === nextId) return
    const metadata = metadataByRoot.get(previousId)
    if (!metadata) return
    metadataByRoot.delete(previousId)
    const rootMetadata = metadata.get(previousId)
    if (rootMetadata) {
      metadata.delete(previousId)
      metadata.set(nextId, rootMetadata)
    }
    metadataByRoot.set(nextId, metadata)
  }

  function rekeyGraph(rootGraphId: UUID, previousId: UUID, nextId: UUID): void {
    if (previousId === nextId) return
    const metadata = metadataByRoot.get(rootGraphId)
    const existing = metadata?.get(previousId)
    if (!metadata || !existing) return
    metadata.delete(previousId)
    metadata.set(nextId, existing)
  }

  function has(rootGraphId: UUID, graphId: UUID = rootGraphId): boolean {
    return metadataByRoot.get(rootGraphId)?.has(graphId) ?? false
  }

  function hasRoot(rootGraphId: UUID): boolean {
    return metadataByRoot.has(rootGraphId)
  }

  function clear(rootGraphId: UUID, graphId?: UUID): void {
    if (graphId === undefined) {
      metadataByRoot.delete(rootGraphId)
      return
    }
    const metadata = metadataByRoot.get(rootGraphId)
    metadata?.delete(graphId)
    if (metadata?.size === 0) metadataByRoot.delete(rootGraphId)
  }

  return { clear, get, has, hasRoot, rekeyGraph, rekeyRoot }
})
