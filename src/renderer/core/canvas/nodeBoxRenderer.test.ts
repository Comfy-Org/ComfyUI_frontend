import { describe, expect, it, vi } from 'vitest'

import {
  drawNodeBoxes,
  includeNodeTitleInBounds
} from '@/renderer/core/canvas/nodeBoxRenderer'
import type { NodeBox } from '@/renderer/core/canvas/nodeBoxRenderer'

function fakeContext(rejectedColor?: string) {
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
      if (value !== rejectedColor) fillStyle = value
    }
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills }
}

/** Both axes vary, so a transposed intersection test cannot pass. */
const box = (x: number, y = 0, color?: string): NodeBox => ({
  bounds: { x, y, width: 100, height: 50 },
  color
})

const VIEWPORT = { x: 0, y: 0, width: 1000, height: 1000 }
const CAMERA = { x: 0, y: 0, z: 1 }
const STYLE = {
  defaultColor: '#333',
  defaultTitleColor: '#444',
  defaultSlotColor: '#778',
  widgetColor: '#222'
}

describe('includeNodeTitleInBounds', () => {
  it('expands a body-only layout rect upward exactly once', () => {
    expect(
      includeNodeTitleInBounds({ x: 100, y: 200, width: 300, height: 120 }, 30)
    ).toEqual({ x: 100, y: 170, width: 300, height: 150 })
  })
})

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

  it('culls on the vertical axis as well as the horizontal', () => {
    // The x-only fixture this replaced left the Y axis of `intersects`
    // uncovered, so transposing its axes was a silent no-op.
    const { ctx, fills } = fakeContext()

    const drawn = drawNodeBoxes(
      ctx,
      [box(0, 0), box(0, 500), box(0, 50_000), box(0, -50_000)],
      CAMERA,
      VIEWPORT,
      STYLE
    )

    expect(drawn).toBe(2)
    expect(fills.map((f) => f.rect[1])).toEqual([0, 500])
  })

  it('tests each axis against its own axis', () => {
    // A square viewport at the origin makes transposing x and y in the
    // intersection test symmetric, so it passes anyway. An offset, non-square
    // viewport is what actually pins the axes.
    const { ctx } = fakeContext()
    const offset = { x: 500, y: 10, width: 200, height: 40 }

    const inside: NodeBox = {
      bounds: { x: 520, y: 20, width: 100, height: 20 }
    }

    expect(drawNodeBoxes(ctx, [inside], CAMERA, offset, STYLE)).toBe(1)
  })

  it('keeps boxes straddling the viewport edge', () => {
    const { ctx } = fakeContext()

    const straddling = [box(-50, 0), box(980, 0), box(0, -25), box(0, 980)]

    expect(drawNodeBoxes(ctx, straddling, CAMERA, VIEWPORT, STYLE)).toBe(4)
  })

  it('uses each node colour, falling back to the default', () => {
    const { ctx, fills } = fakeContext()

    drawNodeBoxes(
      ctx,
      [box(0, 0, '#abcdef'), box(200)],
      CAMERA,
      VIEWPORT,
      STYLE
    )

    expect(fills.map((f) => f.color)).toEqual(['#abcdef', '#333'])
  })

  it('falls back when the canvas rejects a node colour', () => {
    const { ctx, fills } = fakeContext('not-a-color')

    drawNodeBoxes(
      ctx,
      [box(0, 0, '#abcdef'), box(200, 0, 'not-a-color')],
      CAMERA,
      VIEWPORT,
      STYLE
    )

    expect(fills.map((fill) => fill.color)).toEqual(['#abcdef', '#333'])
  })

  it('applies the camera to the context rather than to each box', () => {
    const { ctx, fills } = fakeContext()

    drawNodeBoxes(ctx, [box(10)], { x: -5, y: -7, z: 2 }, VIEWPORT, STYLE)

    expect(ctx.scale).toHaveBeenCalledWith(2, 2)
    expect(ctx.translate).toHaveBeenCalledWith(-5, -7)
    // Bounds stay in graph space; the context carries the transform.
    expect(fills[0].rect).toEqual([10, 0, 100, 50])
  })

  it('draws the title bar, separator, widgets and slots litegraph draws', () => {
    // Under low_quality litegraph still renders all of these; a bare rectangle
    // makes the graph change shape at the threshold rather than lose detail.
    const { ctx, fills } = fakeContext()

    drawNodeBoxes(
      ctx,
      [
        {
          bounds: { x: 0, y: 0, width: 100, height: 80 },
          color: '#101010',
          titleColor: '#202020',
          titleHeight: 30,
          widgets: [{ x: 15, y: 40, width: 70, height: 20 }],
          slots: [{ x: 0, y: 45, color: '#ff0000' }]
        }
      ],
      CAMERA,
      VIEWPORT,
      STYLE
    )

    const body = fills.find((f) => f.color === '#101010')
    expect(body?.rect).toEqual([0, 0, 100, 80])

    const title = fills.find((f) => f.color === '#202020')
    expect(title?.rect).toEqual([0, 0, 100, 30])

    const separator = fills.find((f) => f.color === 'rgba(0,0,0,0.2)')
    expect(separator?.rect).toEqual([0, 29, 100, 2])

    const widget = fills.find((f) => f.color === '#222')
    expect(widget?.rect).toEqual([15, 40, 70, 20])

    // 8x8, centred on the slot position, matching NodeSlot's low-quality path.
    const slot = fills.find((f) => f.color === '#ff0000')
    expect(slot?.rect).toEqual([-4, 41, 8, 8])
  })

  it('omits title, widgets and slots when a node has none', () => {
    const { ctx, fills } = fakeContext()

    drawNodeBoxes(ctx, [box(0)], CAMERA, VIEWPORT, STYLE)

    expect(fills).toHaveLength(1)
    expect(fills[0].color).toBe('#333')
  })
})
