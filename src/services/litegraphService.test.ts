import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({
  app: { canvas: undefined },
  ComfyApp: class {}
}))

import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'

describe('useLitegraphService().getCanvasCenter', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('returns origin when canvas is not yet initialised', () => {
    Reflect.set(app, 'canvas', undefined)

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([0, 0])
  })

  it('returns origin when canvas exists but ds.visible_area is missing', () => {
    Reflect.set(app, 'canvas', { ds: {} })

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([0, 0])
  })

  it('returns the visible-area centre once the canvas is ready', () => {
    Reflect.set(app, 'canvas', {
      ds: { visible_area: [10, 20, 200, 100] }
    })

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([110, 70])
  })
})
