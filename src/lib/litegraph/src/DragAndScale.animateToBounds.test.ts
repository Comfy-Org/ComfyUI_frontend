import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DragAndScale } from '@/lib/litegraph/src/DragAndScale'

type Bounds = [number, number, number, number]

/**
 * Frames are captured rather than run inline: `animate` closes over the
 * `animationId` that `requestAnimationFrame` returns, so invoking the callback
 * synchronously from the stub would hit the temporal dead zone.
 */
let pendingFrame: ((timestamp: number) => void) | null = null

function createDragAndScale(width: number, height: number) {
  return new DragAndScale({ width, height } as HTMLCanvasElement)
}

/** Run the animation through to its end state. */
function settle() {
  const frame = pendingFrame
  pendingFrame = null
  frame?.(performance.now() + 10_000)
}

/** Screen-space X of the center of a `[x, y, width, height]` bounds rect. */
function screenCenterX(ds: DragAndScale, bounds: Bounds) {
  return (bounds[0] + bounds[2] * 0.5 + ds.offset[0]) * ds.scale
}

describe('DragAndScale.animateToBounds', () => {
  beforeEach(() => {
    pendingFrame = null
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: (timestamp: number) => void) => {
        pendingFrame = callback
        return 1
      }
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('centers the bounds on the full canvas by default', () => {
    const ds = createDragAndScale(1600, 900)
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, vi.fn(), { zoom: 0 })
    settle()

    expect(screenCenterX(ds, bounds)).toBeCloseTo(800)
  })

  it('centers the bounds within a narrower viewport instead of the full canvas', () => {
    const ds = createDragAndScale(1600, 900)
    const bounds: Bounds = [0, 0, 100, 100]

    // Simulates an agent panel covering the right 500px of the canvas.
    ds.animateToBounds(bounds, vi.fn(), {
      zoom: 0,
      viewport: [0, 0, 1100, 900]
    })
    settle()

    expect(screenCenterX(ds, bounds)).toBeCloseTo(550)
  })

  it('fits the zoom to the viewport size rather than the full canvas', () => {
    const ds = createDragAndScale(1600, 900)
    const bounds: Bounds = [0, 0, 100, 100]

    ds.animateToBounds(bounds, vi.fn(), {
      zoom: 0.75,
      viewport: [0, 0, 1100, 900]
    })
    settle()

    // min((0.75 * 1100) / 300, (0.75 * 900) / 300) = min(2.75, 2.25)
    expect(ds.scale).toBeCloseTo(2.25)
  })
})
