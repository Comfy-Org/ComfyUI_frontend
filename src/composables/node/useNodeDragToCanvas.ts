import { ref, shallowRef } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLitegraphService } from '@/services/litegraphService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const isDragging = ref(false)
const draggedNode = shallowRef<ComfyNodeDefImpl | null>(null)
const cursorPosition = ref({ x: 0, y: 0 })
let listenersSetup = false

function updatePosition(e: PointerEvent) {
  cursorPosition.value = { x: e.clientX, y: e.clientY }
}

function cancelDrag() {
  isDragging.value = false
  draggedNode.value = null
}

function endDrag(e: PointerEvent) {
  if (!isDragging.value || !draggedNode.value) return

  const canvasStore = useCanvasStore()
  const canvas = canvasStore.canvas
  if (!canvas) {
    cancelDrag()
    return
  }

  const canvasElement = canvas.canvas as HTMLCanvasElement
  const rect = canvasElement.getBoundingClientRect()
  const isOverCanvas =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom

  if (isOverCanvas) {
    const pos = canvas.convertEventToCanvasOffset(e)
    const litegraphService = useLitegraphService()
    litegraphService.addNodeOnGraph(draggedNode.value, { pos })
  }

  cancelDrag()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') cancelDrag()
}

function setupGlobalListeners() {
  if (listenersSetup) return
  listenersSetup = true

  document.addEventListener('pointermove', updatePosition)
  document.addEventListener('pointerup', endDrag, true)
  document.addEventListener('keydown', handleKeydown)
}

export function useNodeDragToCanvas() {
  function startDrag(nodeDef: ComfyNodeDefImpl) {
    isDragging.value = true
    draggedNode.value = nodeDef
  }

  return {
    isDragging,
    draggedNode,
    cursorPosition,
    startDrag,
    cancelDrag,
    setupGlobalListeners
  }
}
