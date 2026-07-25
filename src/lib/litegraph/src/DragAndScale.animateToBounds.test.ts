import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DragAndScale } from '@/lib/litegraph/src/DragAndScale'

function createDragAndScale(width: number, height: number) {
  return new DragAndScale({ width, height } as HTMLCanvasElement)
}

/** Screen-space X of the center of a `[x, y, width, height]` bounds rect. */
function screenCenterX(
  ds: DragAndScale,
  bounds: [number, number, number, number]
) {
  return (bounds[0] + bounds[2] * 0.5 + ds.offset[0]) * ds.scale
}

describe('DragAndScale.animateToBounds', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 1)
    // Jump straight to the animation's end state on the first frame.
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: (timestamp: number) => void) => {
        callback(performance.now() + 10_000)
        return 0
      }
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('centers the bounds on the full canvas by default', () => {
    const ds = createDragAndScale(1600, 900)
    const bounds: [number, number, number, number] = [0, 0, 100, 100]

    ds.animateToBounds(bounds, vi.fn(), { zoom: 0 })

    expect(screenCenterX(ds, bounds)).toBeCloseTo(800)
  })

  it('centers the bounds within a narrower viewport instead of the full canvas', () => {
    const ds = createDragAndScale(1600, 900)
    const bounds: [number, number, number, number] = [0, 0, 100, 100]

    // Simulates an agent panel covering the right 500px of the canvas.
    ds.animateToBounds(bounds, vi.fn(), {
      zoom: 0,
      viewport: [0, 0, 1100, 900]
    })

    expect(screenCenterX(ds, bounds)).toBeCloseTo(550)
  })

  it('fits the zoom to the viewport size rather than the full canvas', () => {
    const ds = createDragAndScale(1600, 900)
    const bounds: [number, number, number, number] = [0, 0, 100, 100]

    ds.animateToBounds(bounds, vi.fn(), {
      zoom: 0.75,
      viewport: [0, 0, 1100, 900]
    })

    // min((0.75 * 1100) / 300, (0.75 * 900) / 300) = min(2.75, 2.25)
    expect(ds.scale).toBeCloseTo(2.25)
  })
})
