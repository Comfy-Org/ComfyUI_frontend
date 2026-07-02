import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  canvas: {
    canvas: {},
    ds: {
      scale: 3
    }
  },
  canvasPosToClientPos: vi.fn((pos: [number, number]) => [
    pos[0] + 10,
    pos[1] + 20
  ]),
  getCanvas: vi.fn(),
  getSetting: vi.fn(),
  updateCanvasPosition: vi.fn()
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: mocks.getCanvas
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mocks.getSetting
  })
}))

vi.mock('@/composables/element/useCanvasPositionConversion', () => ({
  useCanvasPositionConversion: vi.fn(() => ({
    canvasPosToClientPos: mocks.canvasPosToClientPos,
    update: mocks.updateCanvasPosition
  }))
}))

const { useAbsolutePosition } = await import('./useAbsolutePosition')

describe('useAbsolutePosition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCanvas.mockReturnValue(mocks.canvas)
    mocks.canvas.ds.scale = 3
  })

  it('positions and scales an element with the canvas scale', () => {
    const { style, updatePosition } = useAbsolutePosition()

    updatePosition({
      pos: [1, 2],
      size: [4, 5]
    })

    expect(style.value).toMatchObject({
      position: 'fixed',
      left: '11px',
      top: '22px',
      width: '12px',
      height: '15px'
    })
  })

  it('uses an explicit scale when provided', () => {
    const { style, updatePosition } = useAbsolutePosition()

    updatePosition({
      pos: [1, 2],
      size: [4, 5],
      scale: 2
    })

    expect(style.value).toMatchObject({
      width: '8px',
      height: '10px'
    })
  })

  it('applies transform scaling without resizing the element bounds', () => {
    const { style, updatePosition } = useAbsolutePosition({
      useTransform: true
    })

    updatePosition({
      pos: [1, 2],
      size: [4, 5],
      scale: 2
    })

    expect(style.value).toMatchObject({
      position: 'fixed',
      transformOrigin: '0 0',
      transform: 'scale(2)',
      left: '11px',
      top: '22px',
      width: '4px',
      height: '5px'
    })
  })
})
