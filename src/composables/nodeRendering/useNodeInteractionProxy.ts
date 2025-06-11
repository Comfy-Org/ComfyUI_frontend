import { computed } from 'vue'
import { useCanvasStore } from '@/stores/graphStore'

export interface NodeInteractionEvent {
  type: 'mousedown' | 'contextmenu' | 'slot-click'
  nodeId: string
  originalEvent: MouseEvent
  slotIndex?: number
}

export function useNodeInteractionProxy() {
  const canvasStore = useCanvasStore()
  
  // Get canvas reference
  const canvas = computed(() => canvasStore.canvas)

  const handleNodeInteraction = (event: NodeInteractionEvent) => {
    const { type, nodeId, originalEvent } = event
    
    if (!canvas.value?.graph) return
    
    const node = canvas.value.graph.getNodeById(Number(nodeId))
    if (!node) return

    switch (type) {
      case 'mousedown':
        // Convert Vue event coordinates back to canvas coordinates
        const rect = canvas.value.canvas.getBoundingClientRect()
        const canvasX = originalEvent.clientX - rect.left
        const canvasY = originalEvent.clientY - rect.top
        
        // Transform to graph coordinates
        const graphPos = canvas.value.convertOffsetToCanvas([canvasX, canvasY])
        
        // Note: simulatedEvent not currently used but kept for future expansion
        
        // Trigger node selection and dragging
        canvas.value.selectNode(node, originalEvent.ctrlKey || originalEvent.metaKey)
        canvas.value.node_dragged = node
        
        // Start drag operation if not holding modifier keys
        if (!originalEvent.ctrlKey && !originalEvent.metaKey && !originalEvent.shiftKey) {
          canvas.value.dragging_canvas = false
          canvas.value.node_dragged = node
          canvas.value.drag_start = [originalEvent.clientX, originalEvent.clientY]
        }
        
        break
        
      case 'contextmenu':
        // Show context menu for the node
        originalEvent.preventDefault()
        canvas.value.showContextMenu(originalEvent, node)
        break
        
      case 'slot-click':
        // Handle slot connection interactions
        if (event.slotIndex !== undefined) {
          const slot = node.inputs?.[event.slotIndex] || node.outputs?.[event.slotIndex]
          if (slot) {
            canvas.value.processSlotClick(node, event.slotIndex, originalEvent)
          }
        }
        break
    }
  }

  return {
    handleNodeInteraction
  }
}