import { describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { fitGraphToView } from './fitGraphToView'

const viewport = [0, 0, 1500, 900] as const

vi.mock('@/composables/canvas/visibleCanvasViewport', () => ({
  visibleCanvasViewport: () => viewport
}))

function fakeCanvas(items: { boundingRect: readonly number[] }[]) {
  return {
    positionableItems: items,
    selectedItems: new Set(items.slice(0, 1)),
    animateToBounds: vi.fn()
  } as unknown as LGraphCanvas
}

describe('fitGraphToView', () => {
  it('frames every item inside the visible viewport even while a selection exists', () => {
    const canvas = fakeCanvas([
      { boundingRect: [0, 0, 100, 100] },
      { boundingRect: [300, 200, 100, 100] }
    ])

    fitGraphToView(canvas)

    expect(canvas.animateToBounds).toHaveBeenCalledWith([-10, -10, 420, 320], {
      viewport
    })
  })

  it('does not animate an empty graph', () => {
    const canvas = fakeCanvas([])

    fitGraphToView(canvas)

    expect(canvas.animateToBounds).not.toHaveBeenCalled()
  })
})
