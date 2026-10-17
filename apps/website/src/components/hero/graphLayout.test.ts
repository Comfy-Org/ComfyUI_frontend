import { describe, expect, it } from 'vitest'

import type { ElementKey, ElementRect } from './graphLayout'
import {
  COLUMN_CENTER,
  CTA,
  ELEMENT_KEYS,
  FLOW,
  PORTS,
  defaultPositions,
  portEdge,
  portPoint
} from './graphLayout'

function overlaps(a: ElementRect, b: ElementRect): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  )
}

describe('FLOW', () => {
  it.for(ELEMENT_KEYS)(
    'keeps the %s element inside the canvas height',
    (key) => {
      const { top, height } = FLOW.elements[key]
      expect(top).toBeGreaterThanOrEqual(0)
      expect(top + height).toBeLessThanOrEqual(FLOW.canvas.height)
    }
  )

  const pairs = ELEMENT_KEYS.flatMap((a, i) =>
    ELEMENT_KEYS.slice(i + 1).map((b): [ElementKey, ElementKey] => [a, b])
  )

  it.for(pairs)('lays %s and %s out without overlap', ([a, b]) => {
    expect(overlaps(FLOW.elements[a], FLOW.elements[b])).toBe(false)
  })

  it('centres the control nodes on the column', () => {
    const { angle, color } = FLOW.elements
    expect((angle.left + color.left + color.width) / 2).toBe(COLUMN_CENTER)
  })

  it('fits the CTA between the control nodes and the canvas bottom', () => {
    const { angle, color } = FLOW.elements
    expect(CTA.top).toBeGreaterThan(angle.top + angle.height)
    expect(CTA.top).toBeGreaterThan(color.top + color.height)
    expect(CTA.top + CTA.height).toBeLessThanOrEqual(FLOW.canvas.height)
  })
})

describe('defaultPositions', () => {
  it('starts every element at its layout corner', () => {
    expect(defaultPositions().angle).toEqual({
      x: FLOW.elements.angle.left,
      y: FLOW.elements.angle.top
    })
  })
})

describe('portPoint', () => {
  it('offsets a port from its owning element position', () => {
    const positions = defaultPositions()

    expect(portPoint(PORTS.inputOut, positions)).toEqual({
      x: FLOW.elements.input.left + PORTS.inputOut.dx,
      y: FLOW.elements.input.top + PORTS.inputOut.dy
    })
  })

  it('follows the element as it moves', () => {
    const positions = { ...defaultPositions(), angle: { x: 30, y: 12 } }

    expect(portPoint(PORTS.angleIn, positions)).toEqual({
      x: 30 + PORTS.angleIn.dx,
      y: 12 + PORTS.angleIn.dy
    })
  })
})

describe('portEdge', () => {
  const moved = { ...defaultPositions(), angle: { x: 30, y: 12 } }

  it.for([
    {
      title: 'leaves an out port through the right edge',
      port: PORTS.colorOut,
      positions: defaultPositions(),
      x: FLOW.elements.color.left + FLOW.elements.color.width
    },
    {
      title: 'enters an in port through the left edge',
      port: PORTS.outputIn,
      positions: defaultPositions(),
      x: FLOW.elements.output.left
    },
    {
      title: 'follows the element as it moves',
      port: PORTS.angleOut,
      positions: moved,
      x: 30 + FLOW.elements.angle.width
    }
  ])('$title, level with the dot', ({ port, positions, x }) => {
    expect(portEdge(port, positions)).toEqual({
      x,
      y: portPoint(port, positions).y
    })
  })
})
