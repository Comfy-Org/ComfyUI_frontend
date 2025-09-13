import { useThrottleFn } from '@vueuse/core'
import { ref } from 'vue'
import type { Ref } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/schemas/comfyWorkflowSchema'
import { api } from '@/scripts/api'

import type { UpdateFlags } from '../types'

interface GraphCallbacks {
  onNodeAdded?: (node: LGraphNode) => void
  onNodeRemoved?: (node: LGraphNode) => void
  onConnectionChange?: (node: LGraphNode) => void
}

export function useMinimapGraph(
  graph: Ref<LGraph | null>,
  onGraphChanged: () => void
) {
  const nodeStatesCache = new Map<NodeId, string>()
  const linksCache = ref<string>('')
  const lastNodeCount = ref(0)
  const updateFlags = ref<UpdateFlags>({
    bounds: false,
    nodes: false,
    connections: false,
    viewport: false
  })

  // Map to store original callbacks per graph ID
  const originalCallbacksMap = new Map<string, GraphCallbacks>()

  const handleGraphChangedThrottled = useThrottleFn(() => {
    onGraphChanged()
  }, 500)

  const setupEventListeners = () => {
    const g = graph.value
    if (!g) return

    // Check if we've already wrapped this graph's callbacks
    if (originalCallbacksMap.has(g.id)) {
      return
    }

    // Store the original callbacks for this graph
    const originalCallbacks: GraphCallbacks = {
      onNodeAdded: g.onNodeAdded,
      onNodeRemoved: g.onNodeRemoved,
      onConnectionChange: g.onConnectionChange
    }
    originalCallbacksMap.set(g.id, originalCallbacks)

    g.onNodeAdded = function (node: LGraphNode) {
      originalCallbacks.onNodeAdded?.call(this, node)
      void handleGraphChangedThrottled()
    }

    g.onNodeRemoved = function (node: LGraphNode) {
      originalCallbacks.onNodeRemoved?.call(this, node)
      nodeStatesCache.delete(node.id)
      void handleGraphChangedThrottled()
    }

    g.onConnectionChange = function (node: LGraphNode) {
      originalCallbacks.onConnectionChange?.call(this, node)
      void handleGraphChangedThrottled()
    }
  }

  const cleanupEventListeners = (oldGraph?: LGraph) => {
    const g = oldGraph || graph.value
    if (!g) return

    const originalCallbacks = originalCallbacksMap.get(g.id)
    if (!originalCallbacks) {
      console.error(
        'Attempted to cleanup event listeners for graph that was never set up'
      )
      return
    }

    g.onNodeAdded = originalCallbacks.onNodeAdded
    g.onNodeRemoved = originalCallbacks.onNodeRemoved
    g.onConnectionChange = originalCallbacks.onConnectionChange

    originalCallbacksMap.delete(g.id)
  }

  const checkForChangesInternal = () => {
    const g = graph.value
    if (!g) return false

    let structureChanged = false
    let positionChanged = false
    let connectionChanged = false

    if (g._nodes.length !== lastNodeCount.value) {
      structureChanged = true
      lastNodeCount.value = g._nodes.length
    }

    for (const node of g._nodes) {
      const key = node.id
      const currentState = `${node.pos[0]},${node.pos[1]},${node.size[0]},${node.size[1]}`

      if (nodeStatesCache.get(key) !== currentState) {
        positionChanged = true
        nodeStatesCache.set(key, currentState)
      }
    }

    const currentLinks = JSON.stringify(g.links || {})
    if (currentLinks !== linksCache.value) {
      connectionChanged = true
      linksCache.value = currentLinks
    }

    const currentNodeIds = new Set(g._nodes.map((n: LGraphNode) => n.id))
    for (const [nodeId] of nodeStatesCache) {
      if (!currentNodeIds.has(nodeId)) {
        nodeStatesCache.delete(nodeId)
        structureChanged = true
      }
    }

    if (structureChanged || positionChanged) {
      updateFlags.value.bounds = true
      updateFlags.value.nodes = true
    }

    if (connectionChanged) {
      updateFlags.value.connections = true
    }

    return structureChanged || positionChanged || connectionChanged
  }

  const init = () => {
    setupEventListeners()
    api.addEventListener('graphChanged', handleGraphChangedThrottled)
  }

  const destroy = () => {
    cleanupEventListeners()
    api.removeEventListener('graphChanged', handleGraphChangedThrottled)
    nodeStatesCache.clear()
  }

  const clearCache = () => {
    nodeStatesCache.clear()
    linksCache.value = ''
    lastNodeCount.value = 0
  }

  return {
    updateFlags,
    setupEventListeners,
    cleanupEventListeners,
    checkForChanges: checkForChangesInternal,
    init,
    destroy,
    clearCache
  }
}
