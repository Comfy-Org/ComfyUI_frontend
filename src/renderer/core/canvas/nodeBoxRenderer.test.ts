import { describe, expect, it } from 'vitest'

import {
  drawNodeBoxes,
  includeNodeTitleInBounds
} from '@/renderer/core/canvas/nodeBoxRenderer'
import type { NodeBox } from '@/renderer/core/canvas/nodeBoxRenderer'

function fakeContext(rejectedColor?: string) {
  const fills: Array<{ rect: number[]; color: string }> = []
  let fillStyle: CanvasRenderingContext2D['fillStyle'] = ''
  let scale = 1
  let offsetX = 0
  let offsetY = 0
  const ctx: Parameters<typeof drawNodeBoxes>[0] = {
    save: () => {},
    restore: () => {},
    scale: (x: number) => {
      scale *= x
    },
    translate: (x: number, y: number) => {
      offsetX += scale * x
      offsetY += scale * y
    },
    fillRect: (x: number, y: number, width: number, height: number) => {
      fills.push({
        rect: [
          scale * x + offsetX,
          scale * y + offsetY,
          scale * width,
          scale * height
        ],
        color: String(fillStyle)
      })
    },
    get fillStyle() {
      return fillStyle
    },
    set fillStyle(value) {
      if (value !== rejectedColor) fillStyle = value
    }
  }
  return { ctx, fills }
}

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

  it('places boxes on screen through the camera', () => {
    const { ctx, fills } = fakeContext()

    drawNodeBoxes(ctx, [box(10)], { x: -5, y: -7, z: 2 }, VIEWPORT, STYLE)

    expect(fills[0].rect).toEqual([10, -14, 200, 100])
  })

  it('paints each node over the details of the nodes before it', () => {
    const { ctx, fills } = fakeContext()
    const rear: NodeBox = {
      ...box(0, 0, '#101010'),
      widgets: [{ x: 15, y: 10, width: 70, height: 20 }]
    }
    const front = box(50, 0, '#303030')

    drawNodeBoxes(ctx, [rear, front], CAMERA, VIEWPORT, STYLE)

    expect(fills.map((fill) => fill.color)).toEqual([
      '#101010',
      '#222',
      '#303030'
    ])
  })

  it('draws the title bar, separator, widgets and slots litegraph draws', () => {
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
