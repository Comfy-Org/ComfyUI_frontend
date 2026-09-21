import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useCanvasInteractions as realUseCanvasInteractions } from '../useCanvasInteractions'

const shouldHandleNodePointerEvents = computed(() => true)
const canEditNodes = computed(() => true)
const canFocusWidgets = computed(() => true)

const canvasInteractions: ReturnType<typeof realUseCanvasInteractions> = {
  handleWheel: vi.fn(),
  handlePointerDown: vi.fn(),
  handlePointerMove: vi.fn(),
  handlePointerUp: vi.fn(),
  forwardEventToCanvas: vi.fn(),
  shouldHandleNodePointerEvents,
  canEditNodes,
  canFocusWidgets
}

export const useCanvasInteractions = vi.fn(() => {
  onTestFinished(() => {
    canvasInteractions.shouldHandleNodePointerEvents =
      shouldHandleNodePointerEvents
    canvasInteractions.canEditNodes = canEditNodes
    canvasInteractions.canFocusWidgets = canFocusWidgets
  })
  return canvasInteractions
})
