import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { NodeLocatorId } from '@/types/nodeIdentification'

type GraphErrorSource = 'frontend' | 'backend'

type GraphErrorTarget =
  | { kind: 'node'; nodeId: NodeLocatorId }
  | { kind: 'slot'; nodeId: NodeLocatorId; slotName: string }

export interface GraphError {
  key: string
  source: GraphErrorSource
  target: GraphErrorTarget
  code?: string
  message?: string
}

type GraphErrorCommand =
  | { type: 'REPLACE_SOURCE'; source: GraphErrorSource; errors: GraphError[] }
  | { type: 'CLEAR_SOURCE'; source: GraphErrorSource }
  | { type: 'CLEAR_ALL' }

export const useGraphErrorStateStore = defineStore('graphErrorState', () => {
  const errorsByKey = shallowRef(new Map<string, GraphError>())
  const keysBySource = shallowRef(new Map<GraphErrorSource, Set<string>>())
  const keysByNode = shallowRef(new Map<NodeLocatorId, Set<string>>())
  const version = shallowRef(0)

  function addErrorInternal(error: GraphError): void {
    const newErrorsByKey = new Map(errorsByKey.value)
    newErrorsByKey.set(error.key, error)
    errorsByKey.value = newErrorsByKey

    const newKeysBySource = new Map(keysBySource.value)
    if (!newKeysBySource.has(error.source)) {
      newKeysBySource.set(error.source, new Set())
    }
    newKeysBySource.get(error.source)!.add(error.key)
    keysBySource.value = newKeysBySource

    const nodeId = error.target.nodeId
    const newKeysByNode = new Map(keysByNode.value)
    if (!newKeysByNode.has(nodeId)) {
      newKeysByNode.set(nodeId, new Set())
    }
    newKeysByNode.get(nodeId)!.add(error.key)
    keysByNode.value = newKeysByNode
  }

  function clearSourceInternal(source: GraphErrorSource): void {
    const keys = keysBySource.value.get(source)
    if (!keys || keys.size === 0) return

    const newErrorsByKey = new Map(errorsByKey.value)
    const newKeysByNode = new Map(keysByNode.value)

    for (const key of keys) {
      const error = newErrorsByKey.get(key)
      if (error) {
        const nodeId = error.target.nodeId
        const nodeKeys = newKeysByNode.get(nodeId)
        if (nodeKeys) {
          const newNodeKeys = new Set(nodeKeys)
          newNodeKeys.delete(key)
          if (newNodeKeys.size === 0) {
            newKeysByNode.delete(nodeId)
          } else {
            newKeysByNode.set(nodeId, newNodeKeys)
          }
        }
        newErrorsByKey.delete(key)
      }
    }

    errorsByKey.value = newErrorsByKey
    keysByNode.value = newKeysByNode

    const newKeysBySource = new Map(keysBySource.value)
    newKeysBySource.delete(source)
    keysBySource.value = newKeysBySource
  }

  function execute(command: GraphErrorCommand): void {
    switch (command.type) {
      case 'REPLACE_SOURCE': {
        clearSourceInternal(command.source)
        for (const error of command.errors) {
          addErrorInternal(error)
        }
        break
      }
      case 'CLEAR_SOURCE': {
        clearSourceInternal(command.source)
        break
      }
      case 'CLEAR_ALL': {
        errorsByKey.value = new Map()
        keysBySource.value = new Map()
        keysByNode.value = new Map()
        break
      }
    }
    version.value++
  }

  function getErrorsForNode(nodeId: NodeLocatorId): GraphError[] {
    const keys = keysByNode.value.get(nodeId)
    if (!keys) return []
    return [...keys]
      .map((k) => errorsByKey.value.get(k))
      .filter((e): e is GraphError => e !== undefined)
  }

  function hasErrorsForNode(nodeId: NodeLocatorId): boolean {
    const keys = keysByNode.value.get(nodeId)
    return keys !== undefined && keys.size > 0
  }

  function getSlotErrors(
    nodeId: NodeLocatorId,
    slotName: string
  ): GraphError[] {
    return getErrorsForNode(nodeId).filter(
      (e) => e.target.kind === 'slot' && e.target.slotName === slotName
    )
  }

  function hasSlotError(nodeId: NodeLocatorId, slotName: string): boolean {
    return getSlotErrors(nodeId, slotName).length > 0
  }

  return {
    version,
    errorsByKey,
    keysByNode,
    keysBySource,
    execute,
    getErrorsForNode,
    hasErrorsForNode,
    getSlotErrors,
    hasSlotError
  }
})
