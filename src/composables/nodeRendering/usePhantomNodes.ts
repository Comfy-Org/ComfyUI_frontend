import { computed } from 'vue'
import type { LGraphNode } from '@comfyorg/litegraph'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

export function usePhantomNodes() {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  
  // Get canvas reference
  const canvas = computed(() => canvasStore.canvas)
  
  // Check if Vue node rendering is enabled
  const vueRenderingEnabled = computed(() => true) // Temporarily enabled for testing

  /**
   * Enable phantom mode for a specific node
   * @param nodeId The ID of the node to make phantom
   */
  const enablePhantomMode = (nodeId: string | number) => {
    if (!canvas.value?.graph) return false
    
    const node = canvas.value.graph.getNodeById(Number(nodeId))
    if (!node) return false
    
    node.phantom_mode = true
    // Trigger canvas redraw to hide the node visually
    canvas.value.setDirty(true, true)
    
    return true
  }

  /**
   * Disable phantom mode for a specific node
   * @param nodeId The ID of the node to make visible again
   */
  const disablePhantomMode = (nodeId: string | number) => {
    if (!canvas.value?.graph) return false
    
    const node = canvas.value.graph.getNodeById(Number(nodeId))
    if (!node) return false
    
    node.phantom_mode = false
    // Trigger canvas redraw to show the node visually
    canvas.value.setDirty(true, true)
    
    return true
  }

  /**
   * Toggle phantom mode for a specific node
   * @param nodeId The ID of the node to toggle
   */
  const togglePhantomMode = (nodeId: string | number) => {
    if (!canvas.value?.graph) return false
    
    const node = canvas.value.graph.getNodeById(Number(nodeId))
    if (!node) return false
    
    const newMode = !node.phantom_mode
    node.phantom_mode = newMode
    // Trigger canvas redraw
    canvas.value.setDirty(true, true)
    
    return newMode
  }

  /**
   * Enable phantom mode for all nodes (global Vue rendering)
   */
  const enableAllPhantomMode = () => {
    if (!canvas.value?.graph) return 0
    
    let count = 0
    for (const node of canvas.value.graph._nodes) {
      if (!node.phantom_mode) {
        node.phantom_mode = true
        count++
      }
    }
    
    if (count > 0) {
      canvas.value.setDirty(true, true)
    }
    
    return count
  }

  /**
   * Disable phantom mode for all nodes (back to canvas rendering)
   */
  const disableAllPhantomMode = () => {
    if (!canvas.value?.graph) return 0
    
    let count = 0
    for (const node of canvas.value.graph._nodes) {
      if (node.phantom_mode) {
        node.phantom_mode = false
        count++
      }
    }
    
    if (count > 0) {
      canvas.value.setDirty(true, true)
    }
    
    return count
  }

  /**
   * Get all phantom nodes
   */
  const getPhantomNodes = (): LGraphNode[] => {
    if (!canvas.value?.graph) return []
    
    return canvas.value.graph._nodes.filter((node: LGraphNode) => 
      node.phantom_mode === true
    )
  }

  /**
   * Check if a node is in phantom mode
   * @param nodeId The ID of the node to check
   */
  const isPhantomNode = (nodeId: string | number): boolean => {
    if (!canvas.value?.graph) return false
    
    const node = canvas.value.graph.getNodeById(Number(nodeId))
    return node?.phantom_mode === true
  }

  return {
    vueRenderingEnabled,
    enablePhantomMode,
    disablePhantomMode,
    togglePhantomMode,
    enableAllPhantomMode,
    disableAllPhantomMode,
    getPhantomNodes,
    isPhantomNode
  }
}