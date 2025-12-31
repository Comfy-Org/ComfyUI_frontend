import { onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useActiveElement, useMagicKeys } from '@vueuse/core'

import { isMiddlePointerInput } from '@/base/pointerUtils'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'
import { isMultiSelectKey } from '@/renderer/extensions/vueNodes/utils/selectionUtils'
import { app } from '@/scripts/app'

// Forward spacebar key events to litegraph for panning when Vue nodes have focus
let spacebarForwardingInitialized = false

function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return false
}

function initSpacebarForwarding() {
  if (spacebarForwardingInitialized) return
  spacebarForwardingInitialized = true

  const { space } = useMagicKeys()
  const activeElement = useActiveElement()

  watch(space, (isPressed) => {
    const canvas = app.canvas
    if (!canvas) return

    // Skip if canvas has focus (litegraph handles it) or if in editable element
    if (activeElement.value === canvas.canvas) return
    if (isEditableElement(activeElement.value!)) return

    // Mirror litegraph's processKey behavior for spacebar
    if (isPressed) {
      canvas.read_only = true
      // Set dragging_canvas based on current pointer state
      if (canvas.pointer?.isDown) {
        canvas.dragging_canvas = true
      }
    } else {
      canvas.read_only = false
      canvas.dragging_canvas = false
    }
  })
}

export function useNodePointerInteractions(
  nodeIdRef: MaybeRefOrGetter<string>
) {
  // Initialize spacebar forwarding for panning when Vue nodes have focus
  initSpacebarForwarding()

  const { startDrag, endDrag, handleDrag } = useNodeDrag()
  // Use canvas interactions for proper wheel event handling and pointer event capture control
  const { forwardEventToCanvas, shouldHandleNodePointerEvents } =
    useCanvasInteractions()
  const { handleNodeSelect, toggleNodeSelectionAfterPointerUp } =
    useNodeEventHandlers()
  const { nodeManager } = useVueNodeLifecycle()

  const forwardMiddlePointerIfNeeded = (event: PointerEvent) => {
    if (!isMiddlePointerInput(event)) return false
    forwardEventToCanvas(event)
    return true
  }

  let hasDraggingStarted = false

  const startPosition = ref({ x: 0, y: 0 })

  const DRAG_THRESHOLD = 3 // pixels

  function onPointerdown(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event)) return

    // Only start drag on left-click (button 0)
    if (event.button !== 0) return

    // Don't handle pointer events when canvas is in panning mode - forward to canvas instead
    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    const nodeId = toValue(nodeIdRef)
    if (!nodeId) {
      console.warn(
        'LGraphNode: nodeData is null/undefined in handlePointerDown'
      )
      return
    }

    // IMPORTANT: Read from actual LGraphNode to get correct state
    if (nodeManager.value?.getNode(nodeId)?.flags?.pinned) {
      return
    }

    startPosition.value = { x: event.clientX, y: event.clientY }

    safeDragStart(event, nodeId)
  }

  function onPointermove(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event)) return

    // Don't handle pointer events when canvas is in panning mode - forward to canvas instead
    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    // Don't activate drag while resizing
    if (layoutStore.isResizingVueNodes.value) return

    const nodeId = toValue(nodeIdRef)

    if (nodeManager.value?.getNode(nodeId)?.flags?.pinned) {
      return
    }

    const multiSelect = isMultiSelectKey(event)

    const lmbDown = event.buttons & 1
    if (lmbDown && multiSelect && !layoutStore.isDraggingVueNodes.value) {
      layoutStore.isDraggingVueNodes.value = true
      handleNodeSelect(event, nodeId)
      safeDragStart(event, nodeId)
      return
    }
    // Check if we should start dragging (pointer moved beyond threshold)
    if (lmbDown && !layoutStore.isDraggingVueNodes.value) {
      const dx = event.clientX - startPosition.value.x
      const dy = event.clientY - startPosition.value.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > DRAG_THRESHOLD) {
        layoutStore.isDraggingVueNodes.value = true
        handleNodeSelect(event, nodeId)
      }
    }

    if (layoutStore.isDraggingVueNodes.value) {
      handleDrag(event, nodeId)
    }
  }

  function cleanupDragState() {
    layoutStore.isDraggingVueNodes.value = false
  }

  function safeDragStart(event: PointerEvent, nodeId: string) {
    try {
      startDrag(event, nodeId)
    } finally {
      hasDraggingStarted = true
    }
  }

  function safeDragEnd(event: PointerEvent) {
    try {
      const nodeId = toValue(nodeIdRef)
      endDrag(event, nodeId)
    } catch (error) {
      console.error('Error during endDrag:', error)
    } finally {
      hasDraggingStarted = false
      cleanupDragState()
    }
  }

  function onPointerup(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event)) return
    // Don't handle pointer events when canvas is in panning mode - forward to canvas instead
    const canHandlePointer = shouldHandleNodePointerEvents.value
    if (!canHandlePointer) {
      forwardEventToCanvas(event)
      return
    }
    const wasDragging = layoutStore.isDraggingVueNodes.value

    if (hasDraggingStarted || wasDragging) {
      safeDragEnd(event)

      if (wasDragging) {
        return
      }
    }

    // Skip selection handling for right-click (button 2) - context menu handles its own selection
    if (event.button === 2) return

    const multiSelect = isMultiSelectKey(event)

    const nodeId = toValue(nodeIdRef)
    if (nodeId) {
      toggleNodeSelectionAfterPointerUp(nodeId, multiSelect)
    }
  }

  function onPointercancel(event: PointerEvent) {
    if (!layoutStore.isDraggingVueNodes.value) return
    safeDragEnd(event)
  }

  /**
   * Handles right-click during drag operations
   * Cancels the current drag to prevent context menu from appearing while dragging
   */
  function onContextmenu(event: MouseEvent) {
    if (!layoutStore.isDraggingVueNodes.value) return

    event.preventDefault()
    // Simply cleanup state without calling endDrag to avoid synthetic event creation
    cleanupDragState()
  }

  // Cleanup on unmount to prevent resource leaks
  onScopeDispose(() => {
    cleanupDragState()
  })

  const pointerHandlers = {
    onPointerdown,
    onPointermove,
    onPointerup,
    onPointercancel,
    onContextmenu
  } as const

  return {
    pointerHandlers
  }
}
