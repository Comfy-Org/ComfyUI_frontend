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

// Per-graph patch record: the originals captured at install time AND
// the wrappers we installed. Cleanup checks slot identity against the
// installed wrappers — if something else (e.g. useGraphStructureRevision)
// chain-wrapped on top, restoring the original here would clobber it.
interface PatchRecord {
  original: GraphCallbacks
  installed: GraphCallbacks
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

  // Per-graph patch record: original callbacks AND the wrappers we
  // installed. Cleanup uses the installed wrappers to clobber-guard.
  const originalCallbacksMap = new Map<string, PatchRecord>()

  const handleGraphChangedThrottled = useThrottleFn(() => {
    onGraphChanged()
  }, 500)

  const setupEventListeners = () => {
    const g = graph.value
    if (!g) return

    // Resubscribe path: a previous cleanup may have restored only the
    // slots that were not chain-wrapped by an extension, leaving the
    // record alive because the others are still nested inside an
    // extension's wrapper. Per-slot repair re-installs ours where the
    // slot was restored to the original; chain-wrapped slots stay
    // untouched (the extension's wrapper still calls our wrapper
    // internally because that closure captured `original`).
    const existing = originalCallbacksMap.get(g.id)
    if (existing) {
      if (g.onNodeAdded === existing.original.onNodeAdded) {
        g.onNodeAdded = existing.installed.onNodeAdded
      }
      if (g.onNodeRemoved === existing.original.onNodeRemoved) {
        g.onNodeRemoved = existing.installed.onNodeRemoved
      }
      if (g.onConnectionChange === existing.original.onConnectionChange) {
        g.onConnectionChange = existing.installed.onConnectionChange
      }
      if (g.onTrigger === existing.original.onTrigger) {
        g.onTrigger = existing.installed.onTrigger
      }
      return
    }

    // Store the original callbacks for this graph
    const original: GraphCallbacks = {
      onNodeAdded: g.onNodeAdded,
      onNodeRemoved: g.onNodeRemoved,
      onConnectionChange: g.onConnectionChange,
      onTrigger: g.onTrigger
    }

    const installed: GraphCallbacks = {
      onNodeAdded: function (this: LGraph, node: LGraphNode) {
        original.onNodeAdded?.call(this, node)
        void handleGraphChangedThrottled()
      },
      onNodeRemoved: function (this: LGraph, node: LGraphNode) {
        original.onNodeRemoved?.call(this, node)
        nodeStatesCache.delete(node.id)
        void handleGraphChangedThrottled()
      },
      onConnectionChange: function (this: LGraph, node: LGraphNode) {
        original.onConnectionChange?.call(this, node)
        void handleGraphChangedThrottled()
      },
      onTrigger: function (this: LGraph, event: LGraphTriggerEvent) {
        original.onTrigger?.call(this, event)

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
    }

    g.onNodeAdded = installed.onNodeAdded
    g.onNodeRemoved = installed.onNodeRemoved
    g.onConnectionChange = installed.onConnectionChange
    g.onTrigger = installed.onTrigger
    originalCallbacksMap.set(g.id, { original, installed })
  }

  const cleanupEventListeners = (oldGraph?: LGraph) => {
    const g = oldGraph || graph.value
    if (!g) return

    const record = originalCallbacksMap.get(g.id)
    if (!record) {
      // Graph was never set up (e.g., minimap destroyed before init) - nothing to clean up
      return
    }

    // Clobber-guard: only restore the original on slots that still hold
    // OUR installed wrapper. If a later patcher (e.g.
    // useGraphStructureRevision, an extension) chain-wrapped on top,
    // its wrapper now occupies the slot and calls our wrapper
    // internally — restoring the original here would silently uninstall
    // the chain. Leave those slots alone; the chain-wrapper still
    // forwards through `record.original` because our wrapper closure
    // captured it.
    const unhookedAdded = g.onNodeAdded === record.installed.onNodeAdded
    const unhookedRemoved = g.onNodeRemoved === record.installed.onNodeRemoved
    const unhookedConn =
      g.onConnectionChange === record.installed.onConnectionChange
    const unhookedTrigger = g.onTrigger === record.installed.onTrigger

    if (unhookedAdded) g.onNodeAdded = record.original.onNodeAdded
    if (unhookedRemoved) g.onNodeRemoved = record.original.onNodeRemoved
    if (unhookedConn) g.onConnectionChange = record.original.onConnectionChange
    if (unhookedTrigger) g.onTrigger = record.original.onTrigger

    // Only drop the record once every slot is back to the captured
    // original. A chain-wrapped slot still calls our wrapper internally
    // and that wrapper closure reads `record.original` — deleting the
    // record now would orphan that closure, AND the next setup would
    // capture the chain-wrapper as the new "original" and stack a
    // second minimap wrapper underneath it. Keep the record alive so
    // setupEventListeners' resubscribe path can repair the restored
    // slots without re-stacking.
    if (unhookedAdded && unhookedRemoved && unhookedConn && unhookedTrigger) {
      originalCallbacksMap.delete(g.id)
    }
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
