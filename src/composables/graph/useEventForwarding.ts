import { useCanvasStore } from '@/stores/graphStore'

import type { LGraphCanvas } from '../../lib/litegraph/src/litegraph'

export function useEventForwarding() {
  const canvasStore = useCanvasStore()

  // Track active drag operation
  let isDragging = false
  let dragCleanup: (() => void) | null = null
  // Store last known position for escape key handling
  const lastPointerPosition = { x: 0, y: 0 }

  function createSyntheticPointerEvent(
    originalEvent: PointerEvent,
    eventType: string
  ): PointerEvent {
    // Only copy properties that LiteGraph actually uses
    return new PointerEvent(eventType, {
      bubbles: true,
      cancelable: true,
      view: window,
      // Position properties
      clientX: originalEvent.clientX,
      clientY: originalEvent.clientY,
      // Modifier keys
      ctrlKey: originalEvent.ctrlKey,
      shiftKey: originalEvent.shiftKey,
      altKey: originalEvent.altKey,
      metaKey: originalEvent.metaKey,
      // Button state
      button: originalEvent.button,
      buttons: originalEvent.buttons,
      // Pointer tracking
      pointerId: originalEvent.pointerId,
      isPrimary: originalEvent.isPrimary,
      pointerType: originalEvent.pointerType
    })
  }

  function forwardPointerEvent(
    originalEvent: PointerEvent,
    eventType: 'down' | 'move' | 'up'
  ) {
    const canvas: LGraphCanvas | null = canvasStore.getCanvas()
    if (!canvas) {
      console.warn('No canvas available for event forwarding')
      return
    }

    // Prevent original event from bubbling to canvas
    originalEvent.stopPropagation()
    originalEvent.preventDefault()

    // Create synthetic event
    const syntheticEvent = createSyntheticPointerEvent(
      originalEvent,
      `pointer${eventType}`
    )

    // Create a mutable copy of the event for LiteGraph to modify
    const mutableEvent = syntheticEvent as PointerEvent & {
      canvasX?: number
      canvasY?: number
      deltaX?: number
      deltaY?: number
      safeOffsetX?: number
      safeOffsetY?: number
    }

    // Let LiteGraph adjust coordinates to graph space
    // Using 'as any' to bypass TypeScript assertion limitations
    ;(canvas.adjustMouseEvent as any)(mutableEvent)

    // Forward to appropriate handler
    switch (eventType) {
      case 'down':
        canvas.processMouseDown(mutableEvent)
        break
      case 'move':
        canvas.processMouseMove(mutableEvent)
        break
      case 'up':
        canvas.processMouseUp(mutableEvent)
        break
    }
  }

  // Pre-create event handlers to avoid recreating on each pointerdown
  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging) return
    // Update last known position
    lastPointerPosition.x = e.clientX
    lastPointerPosition.y = e.clientY
    forwardPointerEvent(e, 'move')
  }

  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging) return

    isDragging = false
    forwardPointerEvent(e, 'up')

    // Clean up listeners
    if (dragCleanup) {
      dragCleanup()
      dragCleanup = null
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Handle escape key to cancel drag
    if (e.key === 'Escape' && isDragging) {
      isDragging = false

      // Create minimal synthetic cancel event
      const cancelEvent = new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        view: window,
        // Use last known position from the current drag operation
        clientX: lastPointerPosition.x,
        clientY: lastPointerPosition.y,
        button: 0,
        buttons: 0
      })

      const canvas: LGraphCanvas | null = canvasStore.getCanvas()
      if (canvas) {
        const mutableCancelEvent = cancelEvent as PointerEvent & {
          canvasX?: number
          canvasY?: number
          deltaX?: number
          deltaY?: number
          safeOffsetX?: number
          safeOffsetY?: number
        }
        ;(canvas.adjustMouseEvent as any)(mutableCancelEvent)
        canvas.processMouseUp(mutableCancelEvent)
      }

      // Clean up
      if (dragCleanup) {
        dragCleanup()
        dragCleanup = null
      }
    }
  }

  function handleSlotPointerDown(originalEvent: PointerEvent) {
    // Forward the initial pointer down
    forwardPointerEvent(originalEvent, 'down')

    // Set up drag handling
    isDragging = true
    // Initialize last known position
    lastPointerPosition.x = originalEvent.clientX
    lastPointerPosition.y = originalEvent.clientY

    // Add global listeners for drag handling
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    document.addEventListener('keydown', handleKeyDown, true)

    // Store cleanup function
    dragCleanup = () => {
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }

  // Cleanup on unmount
  function cleanup() {
    isDragging = false
    if (dragCleanup) {
      dragCleanup()
      dragCleanup = null
    }
  }

  return {
    handleSlotPointerDown,
    cleanup
  }
}
