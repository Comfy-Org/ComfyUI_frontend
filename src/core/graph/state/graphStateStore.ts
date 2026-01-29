import { defineStore } from 'pinia'
import { customRef } from 'vue'

import type { NodeLocatorId } from '@/types/nodeIdentification'

interface NodeState {
  hasError: boolean
}

interface SetNodeErrorCommand {
  type: 'SetNodeError'
  version: 1
  nodeId: NodeLocatorId
  hasError: boolean
}

interface ClearAllErrorsCommand {
  type: 'ClearAllErrors'
  version: 1
}

type GraphStateCommand = SetNodeErrorCommand | ClearAllErrorsCommand

export const useGraphStateStore = defineStore('graphState', () => {
  const nodes = new Map<NodeLocatorId, NodeState>()

  let revision = 0
  const stateRef = customRef<number>((track, trigger) => ({
    get() {
      track()
      return revision
    },
    set() {
      revision++
      trigger()
    }
  }))

  const execute = (command: GraphStateCommand): void => {
    switch (command.type) {
      case 'SetNodeError': {
        const existing = nodes.get(command.nodeId)
        if (existing) {
          existing.hasError = command.hasError
        } else {
          nodes.set(command.nodeId, { hasError: command.hasError })
        }
        break
      }
      case 'ClearAllErrors': {
        for (const state of nodes.values()) {
          state.hasError = false
        }
        break
      }
    }
    stateRef.value = revision + 1
  }

  const getNodeState = (nodeId: NodeLocatorId): NodeState | undefined => {
    return nodes.get(nodeId)
  }

  const getNodesWithErrors = (): NodeLocatorId[] => {
    const result: NodeLocatorId[] = []
    for (const [nodeId, state] of nodes) {
      if (state.hasError) result.push(nodeId)
    }
    return result
  }

  return {
    stateRef,
    nodes,
    execute,
    getNodeState,
    getNodesWithErrors
  }
})
