import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { NodeId } from '@/renderer/core/layout/types'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

export interface NodeDisplayFlags {
  collapsed?: boolean
  pinned?: boolean
  ghost?: boolean
}

export interface NodeDisplayState {
  id: NodeId
  title: string
  mode: number
  shape?: number
  showAdvanced?: boolean
  color?: string
  bgcolor?: string
  flags: NodeDisplayFlags
}

export type NodeDisplayUpdate = Partial<Omit<NodeDisplayState, 'id'>>

export const useNodeDisplayStore = defineStore('nodeDisplay', () => {
  const graphDisplayStates = ref(new Map<UUID, Map<NodeId, NodeDisplayState>>())

  function getDisplayMap(graphId: UUID): Map<NodeId, NodeDisplayState> {
    const existing = graphDisplayStates.value.get(graphId)
    if (existing) return existing

    const next = reactive(new Map<NodeId, NodeDisplayState>())
    graphDisplayStates.value.set(graphId, next)
    return next
  }

  function registerNode(
    graphId: UUID,
    nodeId: NodeId,
    initial: NodeDisplayState
  ): void {
    getDisplayMap(graphId).set(nodeId, { ...initial })
  }

  function updateNode(
    graphId: UUID,
    nodeId: NodeId,
    update: NodeDisplayUpdate
  ): void {
    const displayMap = getDisplayMap(graphId)
    const existing = displayMap.get(nodeId)
    if (!existing) return

    let changed = false

    for (const key of Object.keys(update) as Array<keyof NodeDisplayUpdate>) {
      if (key === 'flags') {
        const flagUpdate = update.flags
        if (!flagUpdate) continue

        const flagsChanged = Object.keys(flagUpdate).some(
          (fk) =>
            existing.flags[fk as keyof NodeDisplayFlags] !==
            flagUpdate[fk as keyof NodeDisplayFlags]
        )

        if (flagsChanged) {
          existing.flags = { ...existing.flags, ...flagUpdate }
          changed = true
        }
        continue
      }

      if (existing[key] !== update[key]) {
        ;(existing as unknown as Record<string, unknown>)[key] = update[key]
        changed = true
      }
    }

    if (changed) {
      displayMap.set(nodeId, existing)
    }
  }

  function removeNode(graphId: UUID, nodeId: NodeId): void {
    const displayMap = graphDisplayStates.value.get(graphId)
    displayMap?.delete(nodeId)
  }

  function getNode(
    graphId: UUID,
    nodeId: NodeId
  ): NodeDisplayState | undefined {
    return graphDisplayStates.value.get(graphId)?.get(nodeId)
  }

  function clearGraph(graphId: UUID): void {
    graphDisplayStates.value.delete(graphId)
  }

  return {
    getDisplayMap,
    registerNode,
    updateNode,
    removeNode,
    getNode,
    clearGraph
  }
})
