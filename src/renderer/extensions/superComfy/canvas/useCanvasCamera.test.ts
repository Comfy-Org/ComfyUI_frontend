import { describe, expect, it, vi } from 'vitest'

import { screenToWorld } from './canvasGeometry'
import { useCanvasCamera } from './useCanvasCamera'

const viewport = new DOMRect(100, 50, 800, 600)

function wheel(clientX: number, clientY: number, deltaY: number) {
  return { clientX, clientY, deltaY }
}

function pointer(type: string, clientX: number, clientY: number) {
  return new PointerEvent(type, { clientX, clientY, button: 0 })
}

describe('useCanvasCamera', () => {
  it.for([
    { name: 'zooming in', deltaY: -120 },
    { name: 'zooming out', deltaY: 120 }
  ])(
    'keeps the world point under the cursor fixed when $name',
    ({ deltaY }) => {
      const { camera, onWheel } = useCanvasCamera(
        { x: 30, y: 20, zoom: 1.5 },
        vi.fn()
      )
      const cursor = { x: 400 - viewport.left, y: 300 - viewport.top }
      const before = screenToWorld(cursor, camera.value)

      onWheel(wheel(400, 300, deltaY), viewport)

      const after = screenToWorld(cursor, camera.value)
      expect(camera.value.zoom).not.toBe(1.5)
      expect(after.x).toBeCloseTo(before.x)
      expect(after.y).toBeCloseTo(before.y)
    }
  )

  it('reports the camera once it has been at rest for 300 ms', () => {
    vi.useFakeTimers()
    const onRest = vi.fn()
    const { camera, onWheel } = useCanvasCamera({ x: 0, y: 0, zoom: 1 }, onRest)

    onWheel(wheel(500, 350, -120), viewport)
    vi.advanceTimersByTime(200)
    onWheel(wheel(500, 350, -120), viewport)
    vi.advanceTimersByTime(299)
    expect(onRest).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onRest).toHaveBeenCalledExactlyOnceWith({ ...camera.value })
  })

  it('pans by the pointer movement until the pointer is released', () => {
    const { camera, startPan } = useCanvasCamera(
      { x: 10, y: 10, zoom: 2 },
      vi.fn()
    )

    startPan(pointer('pointerdown', 200, 200))
    window.dispatchEvent(pointer('pointermove', 250, 170))
    window.dispatchEvent(pointer('pointerup', 250, 170))
    window.dispatchEvent(pointer('pointermove', 400, 400))

    expect(camera.value).toEqual({ x: 60, y: -20, zoom: 2 })
  })
})
