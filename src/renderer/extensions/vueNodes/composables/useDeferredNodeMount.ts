import { shallowReactive, watch } from 'vue'
import type { Ref } from 'vue'

import type { NodeId } from '@comfyorg/graph-model/nodeId'

interface DeferredNodeMountOptions {
  nodeIds: Ref<readonly NodeId[]>
  isLowQuality: Ref<boolean>
  keptNodeIds: Ref<ReadonlySet<NodeId>>
  isNodeInView: (nodeId: NodeId) => boolean
  viewVersion: () => unknown
}

/** Leaving low-quality rendering mounts only visible never-mounted nodes; the rest mount when they scroll into view. */
export function useDeferredNodeMount({
  nodeIds,
  isLowQuality,
  keptNodeIds,
  isNodeInView,
  viewVersion
}: DeferredNodeMountOptions) {
  const deferredNodeIds = shallowReactive(new Set<NodeId>())
  let everMountedNodeIds = new Set<NodeId>()

  function isNodeMounted(nodeId: NodeId): boolean {
    return isLowQuality.value
      ? keptNodeIds.value.has(nodeId)
      : !deferredNodeIds.has(nodeId)
  }

  watch(
    isLowQuality,
    (lowQuality) => {
      deferredNodeIds.clear()
      if (lowQuality) return
      for (const id of nodeIds.value) {
        if (!everMountedNodeIds.has(id) && !isNodeInView(id)) {
          deferredNodeIds.add(id)
        }
      }
    },
    { flush: 'sync' }
  )

  watch(viewVersion, () => {
    for (const id of deferredNodeIds) {
      if (isNodeInView(id)) deferredNodeIds.delete(id)
    }
  })

  watch(
    [nodeIds, isLowQuality, () => deferredNodeIds.size, keptNodeIds],
    ([ids]) => {
      const present = new Set(ids)
      for (const id of deferredNodeIds) {
        if (!present.has(id)) deferredNodeIds.delete(id)
      }
      everMountedNodeIds = new Set(
        ids.filter((id) => everMountedNodeIds.has(id) || isNodeMounted(id))
      )
    },
    { immediate: true, flush: 'post' }
  )

  return { isNodeMounted }
}
