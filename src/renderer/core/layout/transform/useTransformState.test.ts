import { describe, expect, it } from 'vitest'

import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { createMockCanvas } from '@/utils/__tests__/canvasTestUtils'

describe('useTransformState', () => {
  it('converts screen coordinates using the canvas offset and zoom', () => {
    const { syncWithCanvas, screenToCanvas } = useTransformState()
    const canvas = createMockCanvas({
      ds: { offset: [100, 50], scale: 2 }
    })

    syncWithCanvas(canvas)

    expect(screenToCanvas({ x: 220, y: 140 })).toEqual({ x: 10, y: 20 })
  })

  it('uses unit zoom for coordinate conversion when the canvas scale is zero', () => {
    const { syncWithCanvas, screenToCanvas } = useTransformState()
    const canvas = createMockCanvas({
      ds: { offset: [0, 0], scale: 0 }
    })

    syncWithCanvas(canvas)

    expect(screenToCanvas({ x: 100, y: 100 })).toEqual({ x: 100, y: 100 })
  })
})
