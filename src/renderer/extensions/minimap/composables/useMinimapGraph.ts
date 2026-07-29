import { useThrottleFn } from '@vueuse/core'
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { api } from '@/scripts/api'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import { MinimapDataSourceFactory } from '../data/MinimapDataSourceFactory'
import type { UpdateFlags } from '../types'

interface GraphCallbacks {
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

  // Track LayoutStore version for change detection
  const layoutStoreVersion = layoutStore.getVersion()

  // Cleanup restores originals only when our wrapper is still on top, and
  // marks any buried wrapper inert via `entry.live` so it can't fire dead work.
  interface InstalledHooks {
    originals: GraphCallbacks
    wrappers: GraphCallbacks
    live: boolean
    disposeListeners: () => void
  }
  const hooksMap = new Map<string, InstalledHooks>()

  const handleGraphChangedThrottled = useThrottleFn(() => {
    onGraphChanged()
  }, 500)

  const setupEventListeners = () => {
    const g = graph.value
    if (!g || hooksMap.has(g.id)) return

    const originals: GraphCallbacks = {
      onConnectionChange: g.onConnectionChange
    }
    const wrappers: GraphCallbacks = {}

    const onNodeAdded = () => void handleGraphChangedThrottled()

    const onNodeRemoved = ({
      detail: { node }
    }: CustomEvent<LGraphEventMap['node:removed']>) => {
      nodeStatesCache.delete(node.id)
      void handleGraphChangedThrottled()
    }

    // A reload of the same workflow leaves the node count and every geometry
    // string identical, so change detection alone cannot tell that `bounds` was
    // last derived mid-configure, from a partially built graph.
    const onConfigured = () => {
      clearCache()
      void handleGraphChangedThrottled()
    }

    const onPropertyChanged = (
      e: CustomEvent<LGraphEventMap['node:property:changed']>
    ) => {
      const { property, nodeId } = e.detail
      if (
        property === 'mode' ||
        property === 'bgcolor' ||
        property === 'color'
      ) {
        nodeStatesCache.delete(toNodeId(nodeId))
        void handleGraphChangedThrottled()
      }
    }

    const entry: InstalledHooks = {
      originals,
      wrappers,
      live: true,
      disposeListeners: () => {
        g.events.removeEventListener('node:added', onNodeAdded)
        g.events.removeEventListener('node:removed', onNodeRemoved)
        g.events.removeEventListener('configured', onConfigured)
        g.events.removeEventListener('node:property:changed', onPropertyChanged)
      }
    }
    hooksMap.set(g.id, entry)

    wrappers.onConnectionChange = useChainCallback(
      originals.onConnectionChange,
      function () {
        if (!entry.live) return
        void handleGraphChangedThrottled()
      }
    )
    g.onConnectionChange = wrappers.onConnectionChange

    g.events.addEventListener('node:added', onNodeAdded)
    g.events.addEventListener('node:removed', onNodeRemoved)
    g.events.addEventListener('configured', onConfigured)
    g.events.addEventListener('node:property:changed', onPropertyChanged)
  }

  const cleanupEventListeners = (oldGraph?: LGraph) => {
    const g = oldGraph || graph.value
    if (!g) return
    const entry = hooksMap.get(g.id)
    if (!entry) return
    const { originals, wrappers } = entry

    if (g.onConnectionChange === wrappers.onConnectionChange)
      g.onConnectionChange = originals.onConnectionChange
    entry.disposeListeners()

    entry.live = false
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
