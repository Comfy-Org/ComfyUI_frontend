import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

vi.mock('@/scripts/app', () => ({
  app: { canvas: null }
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useEventListener: vi.fn()
  }
})

function createMockCanvas(
  readOnly = false
): LGraphCanvas & { onReadOnlyChanged?: (v: boolean) => void } {
  return {
    read_only: readOnly,
    canvas: document.createElement('canvas'),
    onReadOnlyChanged: undefined
  } as unknown as LGraphCanvas & {
    onReadOnlyChanged?: (v: boolean) => void
  }
}

describe('useCanvasStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  describe('isReadOnly', () => {
    it('syncs initial read_only value when canvas is set', async () => {
      const store = useCanvasStore()
      const mockCanvas = createMockCanvas(true)

      store.canvas = mockCanvas as unknown as LGraphCanvas
      await nextTick()

      expect(store.isReadOnly).toBe(true)
    })

    it('updates isReadOnly when onReadOnlyChanged callback fires', async () => {
      const store = useCanvasStore()
      const mockCanvas = createMockCanvas(false)

      store.canvas = mockCanvas as unknown as LGraphCanvas
      await nextTick()

      expect(store.isReadOnly).toBe(false)

      // Simulate space key press → LGraphCanvas sets read_only = true
      mockCanvas.onReadOnlyChanged?.(true)

      expect(store.isReadOnly).toBe(true)

      // Simulate space key release
      mockCanvas.onReadOnlyChanged?.(false)

      expect(store.isReadOnly).toBe(false)
    })

    it('registers onReadOnlyChanged callback on the canvas', async () => {
      const store = useCanvasStore()
      const mockCanvas = createMockCanvas(false)

      store.canvas = mockCanvas as unknown as LGraphCanvas
      await nextTick()

      expect(mockCanvas.onReadOnlyChanged).toBeDefined()
      expect(typeof mockCanvas.onReadOnlyChanged).toBe('function')
    })
  })
})
