import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    isAppMode: { value: false },
    setMode: vi.fn()
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      ds: {
        scale: 1,
        offset: [0, 0] as [number, number],
        onChanged: undefined as
          | ((scale: number, offset: [number, number]) => void)
          | undefined,
        element: null,
        changeScale: vi.fn()
      },
      setDirty: vi.fn(),
      graph: null,
      selectedItems: new Set(),
      subgraph: undefined,
      canvas: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    }
  }
}))

describe('useCanvasStore', () => {
  let store: ReturnType<typeof useCanvasStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useCanvasStore()
    vi.clearAllMocks()
  })

  describe('appScalePercentage', () => {
    it('skips reactive update when rounded scale has not changed', async () => {
      const { app } = await import('@/scripts/app')

      app.canvas.ds.scale = 1.004
      store.initScaleSync()
      expect(store.appScalePercentage).toBe(100)

      const watcher = vi.fn()
      const stop = watch(() => store.appScalePercentage, watcher)

      // Simulate zoom events with scales that all round to 100
      app.canvas.ds.scale = 1.001
      app.canvas.ds.onChanged!(app.canvas.ds.scale, app.canvas.ds.offset)
      app.canvas.ds.scale = 1.003
      app.canvas.ds.onChanged!(app.canvas.ds.scale, app.canvas.ds.offset)

      expect(watcher).not.toHaveBeenCalled()
      expect(store.appScalePercentage).toBe(100)

      stop()
    })

    it('updates reactive value when rounded scale changes', async () => {
      const { app } = await import('@/scripts/app')

      app.canvas.ds.scale = 1.0
      store.initScaleSync()
      expect(store.appScalePercentage).toBe(100)

      app.canvas.ds.scale = 1.5
      app.canvas.ds.onChanged!(app.canvas.ds.scale, app.canvas.ds.offset)

      expect(store.appScalePercentage).toBe(150)
    })

    it('preserves original onChanged handler', async () => {
      const { app } = await import('@/scripts/app')
      const originalHandler = vi.fn()
      app.canvas.ds.onChanged = originalHandler

      app.canvas.ds.scale = 1.0
      store.initScaleSync()

      app.canvas.ds.scale = 2.0
      app.canvas.ds.onChanged!(app.canvas.ds.scale, app.canvas.ds.offset)

      expect(originalHandler).toHaveBeenCalledWith(2.0, app.canvas.ds.offset)
    })
  })
})
