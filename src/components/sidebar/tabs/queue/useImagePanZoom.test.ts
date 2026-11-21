import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useImagePanZoom } from './useImagePanZoom'

function setup() {
  const target = ref(document.createElement('div'))
  return useImagePanZoom(target)
}

function wheel(deltaY: number, clientX: number, clientY: number) {
  const event = new WheelEvent('wheel', { deltaY })
  Object.defineProperty(event, 'clientX', { value: clientX })
  Object.defineProperty(event, 'clientY', { value: clientY })
  return event
}

function pointer(pointerId: number, clientX: number, clientY: number) {
  return new PointerEvent('pointermove', {
    pointerId,
    clientX,
    clientY,
    button: 0
  })
}

function doubleClick(clientX: number, clientY: number) {
  return new MouseEvent('dblclick', { clientX, clientY })
}

describe('useImagePanZoom', () => {
  it('zooms in by 10% toward the cursor on wheel up', () => {
    const panZoom = setup()

    panZoom.handleWheel(wheel(-1, 100, 50))

    expect(panZoom.scale.value).toBeCloseTo(1.1)
    expect(panZoom.offset.value).toEqual({
      x: expect.closeTo(-10),
      y: expect.closeTo(-5)
    })
  })

  it('does not zoom out past the fitted size', () => {
    const panZoom = setup()

    panZoom.handleWheel(wheel(1, 100, 50))

    expect(panZoom.isZoomed.value).toBe(false)
    expect(panZoom.scale.value).toBe(1)
  })

  it('ignores wheel events with no vertical delta', () => {
    const panZoom = setup()
    panZoom.handleWheel(wheel(-1, 100, 50))

    panZoom.handleWheel(wheel(0, 100, 50))

    expect(panZoom.scale.value).toBeCloseTo(1.1)
  })

  it('recenters when zooming back out to the fitted size', () => {
    const panZoom = setup()

    panZoom.handleWheel(wheel(-1, 100, 50))
    panZoom.handleWheel(wheel(1, 100, 50))

    expect(panZoom.scale.value).toBe(1)
    expect(panZoom.offset.value).toEqual({ x: 0, y: 0 })
  })

  it('zooms to 2x at the cursor on double-click', () => {
    const panZoom = setup()

    panZoom.handleDoubleClick(doubleClick(100, 50))

    expect(panZoom.transformStyle.value).toEqual({
      transform: 'translate(-100px, -50px) scale(2)',
      transformOrigin: '0 0'
    })
  })

  it('returns to the fitted size on double-click while zoomed in', () => {
    const panZoom = setup()
    panZoom.handleDoubleClick(doubleClick(100, 50))

    panZoom.handleDoubleClick(doubleClick(100, 50))

    expect(panZoom.scale.value).toBe(1)
    expect(panZoom.offset.value).toEqual({ x: 0, y: 0 })
  })

  it('pans by the drag distance while zoomed in', () => {
    const panZoom = setup()
    panZoom.handleDoubleClick(doubleClick(0, 0))

    panZoom.handlePointerDown(pointer(1, 10, 10))
    panZoom.handlePointerMove(pointer(1, 40, 30))

    expect(panZoom.offset.value).toEqual({ x: 30, y: 20 })
  })

  it('does not pan at the fitted size', () => {
    const panZoom = setup()

    panZoom.handlePointerDown(pointer(1, 10, 10))
    panZoom.handlePointerMove(pointer(1, 40, 30))

    expect(panZoom.offset.value).toEqual({ x: 0, y: 0 })
  })

  it('stops panning after the pointer is released', () => {
    const panZoom = setup()
    panZoom.handleDoubleClick(doubleClick(0, 0))

    panZoom.handlePointerDown(pointer(1, 10, 10))
    panZoom.handlePointerUp(pointer(1, 40, 30))
    panZoom.handlePointerMove(pointer(1, 90, 90))

    expect(panZoom.offset.value).toEqual({ x: 0, y: 0 })
  })

  it('pinch-zooms around the midpoint and caps at 10x', () => {
    const panZoom = setup()

    panZoom.handlePointerDown(pointer(1, 0, 0))
    panZoom.handlePointerDown(pointer(2, 10, 0))
    panZoom.handlePointerMove(pointer(2, 200, 0))

    expect(panZoom.scale.value).toBe(10)
    expect(panZoom.offset.value).toEqual({ x: -900, y: 0 })
  })

  it('returns to the fitted size on reset', () => {
    const panZoom = setup()
    panZoom.handleWheel(wheel(-1, 100, 50))

    panZoom.reset()

    expect(panZoom.scale.value).toBe(1)
    expect(panZoom.offset.value).toEqual({ x: 0, y: 0 })
  })
})
