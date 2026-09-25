import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useCanvasInteractions as realUseCanvasInteractions } from '../useCanvasInteractions'

const shouldHandleNodePointerEvents = computed(() => true)

const canvasInteractions: ReturnType<typeof realUseCanvasInteractions> = {
  handleWheel: vi.fn(),
  handlePointerDown: vi.fn(),
  handlePointerMove: vi.fn(),
  handlePointerUp: vi.fn(),
  forwardEventToCanvas: vi.fn(),
  shouldHandleNodePointerEvents
}

export const useCanvasInteractions = vi.fn(() => {
  onTestFinished(() => {
    canvasInteractions.shouldHandleNodePointerEvents =
      shouldHandleNodePointerEvents
  })
  return canvasInteractions
})
