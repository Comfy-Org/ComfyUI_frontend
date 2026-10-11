import { describe, expect, it } from 'vitest'

import { ELEMENT_KEYS, FLOW, PORTS, portPoint } from './graphLayout'

describe('portPoint', () => {
  it('offsets a port from its owning element position', () => {
    const positions = Object.fromEntries(
      ELEMENT_KEYS.map((key) => [
        key,
        { x: FLOW.elements[key].left, y: FLOW.elements[key].top }
      ])
    ) as Record<(typeof ELEMENT_KEYS)[number], { x: number; y: number }>

    expect(portPoint(PORTS.inputOut, positions)).toEqual({
      x: FLOW.elements.input.left + PORTS.inputOut.dx,
      y: FLOW.elements.input.top + PORTS.inputOut.dy
    })
  })

  it('follows the element as it moves', () => {
    const positions = {
      input: { x: 0, y: 0 },
      angle: { x: 30, y: 12 },
      color: { x: 0, y: 0 },
      output: { x: 0, y: 0 }
    }

    expect(portPoint(PORTS.angleIn, positions)).toEqual({
      x: 30 + PORTS.angleIn.dx,
      y: 12 + PORTS.angleIn.dy
    })
  })
})
