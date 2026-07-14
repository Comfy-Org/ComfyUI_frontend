import { beforeEach, describe, expect, it, vi } from 'vitest'

const canvasObj = {
  setGraph: vi.fn()
}

const mocks = vi.hoisted(() => ({
  canvas: null as { setGraph: ReturnType<typeof vi.fn> } | null,
  rootGraph: { id: 'root' }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: mocks.canvas })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return mocks.rootGraph
    }
  }
}))

import { restoreView } from './subgraphNavigation'

describe('subgraphNavigation', () => {
  beforeEach(() => {
    canvasObj.setGraph.mockReset()
    mocks.canvas = canvasObj
  })

  it('returns the canvas to the root graph', () => {
    restoreView()
    expect(canvasObj.setGraph).toHaveBeenCalledWith(mocks.rootGraph)
  })

  it('does not throw without a canvas', () => {
    mocks.canvas = null
    expect(() => restoreView()).not.toThrow()
  })
})
