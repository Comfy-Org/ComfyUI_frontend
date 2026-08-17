import type { ShallowRef } from 'vue'

import type { NodeId } from '@/renderer/core/layout/types'

export function createMountDepartureScheduler(
  mountedNodeIds: ShallowRef<Set<NodeId>>,
  delayMs: number
) {
  let timer: ReturnType<typeof setTimeout> | null = null

  function prune(desiredNodeIds: ReadonlySet<NodeId>): void {
    const current = mountedNodeIds.value
    const retained = new Set<NodeId>()
    for (const nodeId of current) {
      if (desiredNodeIds.has(nodeId)) retained.add(nodeId)
    }
    if (retained.size !== current.size) mountedNodeIds.value = retained
  }

  function schedule(getDesiredNodeIds: () => ReadonlySet<NodeId>): void {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      prune(getDesiredNodeIds())
    }, delayMs)
  }

  function dispose(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  return { prune, schedule, dispose }
}
