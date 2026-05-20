import { useThrottleFn } from '@vueuse/core'
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

import type {
  LGraph,
  LGraphNode,
  LGraphTriggerEvent
} from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { api } from '@/scripts/api'

import { MinimapDataSourceFactory } from '../data/MinimapDataSourceFactory'
import type { UpdateFlags } from '../types'

interface GraphCallbacks {
  onNodeAdded?: (node: LGraphNode) => void
  onNodeRemoved?: (node: LGraphNode) => void
  onConnectionChange?: (node: LGraphNode) => void
  onTrigger?: (event: LGraphTriggerEvent) => void
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

  // Track LayoutStore version for change detection
  const layoutStoreVersion = layoutStore.getVersion()

  // Cleanup restores originals only when our wrapper is still on top, and
  // marks any buried wrapper inert via `isLive()` so it can't fire dead work.
  interface InstalledHooks {
    originals: GraphCallbacks
    wrappers: GraphCallbacks
  }
  const hooksMap = new Map<string, InstalledHooks>()

  const handleGraphChangedThrottled = useThrottleFn(() => {
    onGraphChanged()
  }, 500)

  const setupEventListeners = () => {
    const g = graph.value
    if (!g || hooksMap.has(g.id)) return

    const originals: GraphCallbacks = {
      onNodeAdded: g.onNodeAdded,
      onNodeRemoved: g.onNodeRemoved,
      onConnectionChange: g.onConnectionChange,
      onTrigger: g.onTrigger
    }
    const wrappers: GraphCallbacks = {}
    const entry: InstalledHooks = { originals, wrappers }
    hooksMap.set(g.id, entry)
    const isLive = () => hooksMap.get(g.id) === entry

    wrappers.onNodeAdded = function (node: LGraphNode) {
      originals.onNodeAdded?.call(this, node)
      if (!isLive()) return
      void handleGraphChangedThrottled()
    }
    g.onNodeAdded = wrappers.onNodeAdded

    wrappers.onNodeRemoved = function (node: LGraphNode) {
      originals.onNodeRemoved?.call(this, node)
      if (!isLive()) return
      nodeStatesCache.delete(node.id)
      void handleGraphChangedThrottled()
    }
    g.onNodeRemoved = wrappers.onNodeRemoved

    wrappers.onConnectionChange = function (node: LGraphNode) {
      originals.onConnectionChange?.call(this, node)
      if (!isLive()) return
      void handleGraphChangedThrottled()
    }
    g.onConnectionChange = wrappers.onConnectionChange

    wrappers.onTrigger = function (event: LGraphTriggerEvent) {
      originals.onTrigger?.call(this, event)
      if (!isLive()) return

      // Listen for visual property changes that affect minimap rendering
      if (
        event.type === 'node:property:changed' &&
        (event.property === 'mode' ||
          event.property === 'bgcolor' ||
          event.property === 'color')
      ) {
        // Invalidate cache for this node to force redraw
        nodeStatesCache.delete(String(event.nodeId))
        void handleGraphChangedThrottled()
      }
    }
    g.onTrigger = wrappers.onTrigger
  }

  const cleanupEventListeners = (oldGraph?: LGraph) => {
    const g = oldGraph || graph.value
    if (!g) return
    const entry = hooksMap.get(g.id)
    if (!entry) return
    const { originals, wrappers } = entry

    if (g.onNodeAdded === wrappers.onNodeAdded)
      g.onNodeAdded = originals.onNodeAdded
    if (g.onNodeRemoved === wrappers.onNodeRemoved)
      g.onNodeRemoved = originals.onNodeRemoved
    if (g.onConnectionChange === wrappers.onConnectionChange)
      g.onConnectionChange = originals.onConnectionChange
    if (g.onTrigger === wrappers.onTrigger) g.onTrigger = originals.onTrigger

    hooksMap.delete(g.id)
  }

  const checkForChangesInternal = () => {
    const g = graph.value
    if (!g) return false

    let structureChanged = false
    let positionChanged = false
    let connectionChanged = false

    // Use unified data source for change detection
    const dataSource = MinimapDataSourceFactory.create(g)

    // Check for node count changes
    const currentNodeCount = dataSource.getNodeCount()
    if (currentNodeCount !== lastNodeCount.value) {
      structureChanged = true
      lastNodeCount.value = currentNodeCount
    }

    // Check for node position/size changes
    const nodes = dataSource.getNodes()
    for (const node of nodes) {
      const nodeId = node.id
      const currentState = `${node.x},${node.y},${node.width},${node.height}`

      if (nodeStatesCache.get(nodeId) !== currentState) {
        positionChanged = true
        nodeStatesCache.set(nodeId, currentState)
      }
    }

    // Clean up removed nodes from cache
    const currentNodeIds = new Set(nodes.map((n) => n.id))
    for (const [nodeId] of nodeStatesCache) {
      if (!currentNodeIds.has(nodeId)) {
        nodeStatesCache.delete(nodeId)
        structureChanged = true
      }
    }

    // TODO: update when Layoutstore tracks links
    const currentLinks = JSON.stringify(g.links || {})
    if (currentLinks !== linksCache.value) {
      connectionChanged = true
      linksCache.value = currentLinks
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

    watch(layoutStoreVersion, () => {
      void handleGraphChangedThrottled()
    })
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
