import { describe, expect, it, vi } from 'vitest'

import { drawNodeBoxes } from '@/renderer/core/canvas/nodeBoxRenderer'
import type { NodeBox } from '@/renderer/core/canvas/nodeBoxRenderer'

function fakeContext() {
  const fills: Array<{ rect: number[]; color: string }> = []
  let fillStyle = ''
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    fillRect: (...rect: number[]) => fills.push({ rect, color: fillStyle }),
    get fillStyle() {
      return fillStyle
    },
    set fillStyle(value: string) {
      fillStyle = value
    }
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills }
}

const box = (x: number, color?: string): NodeBox => ({
  bounds: { x, y: 0, width: 100, height: 50 },
  color
})

const VIEWPORT = { x: 0, y: 0, width: 1000, height: 1000 }
const CAMERA = { x: 0, y: 0, z: 1 }
const STYLE = { defaultColor: '#333' }

describe('drawNodeBoxes', () => {
  it('draws only boxes intersecting the viewport', () => {
    const { ctx, fills } = fakeContext()

    const drawn = drawNodeBoxes(
      ctx,
      [box(0), box(500), box(50_000)],
      CAMERA,
      VIEWPORT,
      STYLE
    )

    expect(drawn).toBe(2)
    expect(fills.map((f) => f.rect[0])).toEqual([0, 500])
  })

  it('uses each node colour, falling back to the default', () => {
    const { ctx, fills } = fakeContext()

    drawNodeBoxes(ctx, [box(0, '#abcdef'), box(200)], CAMERA, VIEWPORT, STYLE)

    expect(fills.map((f) => f.color)).toEqual(['#abcdef', '#333'])
  })

  it('applies the camera to the context rather than to each box', () => {
    const { ctx, fills } = fakeContext()

    drawNodeBoxes(ctx, [box(10)], { x: -5, y: -7, z: 2 }, VIEWPORT, STYLE)

    expect(ctx.scale).toHaveBeenCalledWith(2, 2)
    expect(ctx.translate).toHaveBeenCalledWith(-5, -7)
    // Bounds stay in graph space; the context carries the transform.
    expect(fills[0].rect).toEqual([10, 0, 100, 50])
  })
})
