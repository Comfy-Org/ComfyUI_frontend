import { ref, computed, readonly, watchEffect } from 'vue'
import type { LGraphNode } from '@comfyorg/litegraph'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useCanvasStore } from '@/stores/graphStore'
// Note: useEventListener imported but not currently used - may be used for future enhancements

export interface NodePosition {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export function useNodePositionSync() {
  const canvasStore = useCanvasStore()
  const nodePositions = ref<Record<string, NodePosition>>({})
  const canvasScale = ref(1)
  const canvasOffset = ref({ x: 0, y: 0 })

  // Get canvas reference
  const canvas = computed(() => canvasStore.canvas)

  // Sync canvas transform (scale and offset)
  watchEffect(() => {
    if (!canvas.value) return

    const updateTransform = () => {
      if (!canvas.value?.ds) return
      
      canvasScale.value = canvas.value.ds.scale
      canvasOffset.value = {
        x: canvas.value.ds.offset[0],
        y: canvas.value.ds.offset[1]
      }
    }

    // Hook into the canvas draw cycle to update transform
    canvas.value.onDrawForeground = useChainCallback(
      canvas.value.onDrawForeground,
      updateTransform
    )

    // Initial transform update
    updateTransform()
  })

  // Sync node positions
  const syncNodePositions = () => {
    if (!canvas.value?.graph) return

    const positions: Record<string, NodePosition> = {}
    for (const node of canvas.value.graph._nodes) {
      positions[node.id] = {
        id: String(node.id),
        x: node.pos[0],
        y: node.pos[1],
        width: node.size[0],
        height: node.size[1]
      }
    }
    nodePositions.value = positions
  }

  // Listen for node position changes
  watchEffect(() => {
    if (!canvas.value) return

    // Hook into various node update events
    const originalOnNodeMoved = canvas.value.onNodeMoved
    canvas.value.onNodeMoved = useChainCallback(
      originalOnNodeMoved,
      syncNodePositions
    )

    // Hook into general graph changes
    const originalOnGraphChanged = canvas.value.onGraphChanged
    canvas.value.onGraphChanged = useChainCallback(
      originalOnGraphChanged,
      syncNodePositions
    )

    // Initial sync
    syncNodePositions()
  })

  // Get visible nodes (within viewport bounds)
  const visibleNodes = computed(() => {
    if (!canvas.value?.graph) {
      console.log('🚫 useNodePositionSync: No canvas or graph available')
      return []
    }

    const allNodes = canvas.value.graph._nodes
    console.log('🔍 useNodePositionSync: Checking', allNodes.length, 'total nodes')
    
    const phantomNodes = allNodes.filter((node: LGraphNode) => {
      const isPhantom = node.phantom_mode === true
      if (isPhantom) {
        console.log('👻 Found phantom node:', { id: node.id, title: node.title, phantom_mode: node.phantom_mode })
      }
      return isPhantom
    })

    console.log('📊 useNodePositionSync: Found', phantomNodes.length, 'phantom nodes out of', allNodes.length, 'total')
    
    // TODO: Add viewport culling for performance
    // For now, return all phantom nodes
    return phantomNodes
  })

  // Manual sync function for external triggers
  const forceSync = () => {
    syncNodePositions()
  }

  return {
    nodePositions: readonly(nodePositions),
    canvasScale: readonly(canvasScale),
    canvasOffset: readonly(canvasOffset),
    visibleNodes: readonly(visibleNodes),
    forceSync
  }
}