import { describe, expect, it } from 'vitest'

import {
  docWith,
  generateNode,
  ioNode,
  port
} from '@/renderer/extensions/superComfy/engine/engineFixtures'

import {
  cardMinHeight,
  fitView,
  hitPort,
  linkPath,
  portAnchor,
  screenToWorld
} from './canvasGeometry'

function placed<T extends { x: number; y: number; width: number }>(
  node: T,
  x: number,
  y: number,
  width = node.width
): T {
  return { ...node, x, y, width }
}

describe('portAnchor', () => {
  const node = placed(
    generateNode('gen', 'image', {
      inputs: [port('prompt', 'text'), port('image', 'image')]
    }),
    100,
    40,
    280
  )

  it.for([
    { side: 'in', index: 0, expected: { x: 100, y: 64 } },
    { side: 'in', index: 1, expected: { x: 100, y: 92 } },
    { side: 'out', index: 0, expected: { x: 380, y: 64 } }
  ] as const)(
    'puts $side port $index on the card edge at its row',
    ({ side, index, expected }) => {
      expect(portAnchor(node, side, index)).toEqual(expected)
    }
  )
})

describe('linkPath', () => {
  it.for([
    {
      name: 'bends by half the horizontal distance',
      a: { x: 0, y: 0 },
      b: { x: 300, y: 100 },
      expected: 'M 0 0 C 150 0, 150 100, 300 100'
    },
    {
      name: 'keeps a minimum bend for close ports',
      a: { x: 0, y: 0 },
      b: { x: 40, y: 20 },
      expected: 'M 0 0 C 48 0, -8 20, 40 20'
    }
  ])('$name', ({ a, b, expected }) => {
    expect(linkPath(a, b)).toBe(expected)
  })
})

describe('hitPort', () => {
  const source = placed(ioNode('src', 'image'), 0, 0)
  const target = placed(
    generateNode('gen', 'image', {
      inputs: [port('prompt', 'text'), port('image', 'image')]
    }),
    400,
    0
  )
  const doc = docWith([source, target])

  it.for([
    {
      name: 'finds the input under the pointer',
      world: { x: 405, y: 55 },
      radius: 14,
      expected: { node: 'gen', port: 'image' }
    },
    {
      name: 'finds nothing outside the radius',
      world: { x: 430, y: 52 },
      radius: 14,
      expected: null
    },
    {
      name: 'picks the nearer of two inputs in range',
      world: { x: 400, y: 35 },
      radius: 20,
      expected: { node: 'gen', port: 'prompt' }
    }
  ])('$name', ({ world, radius, expected }) => {
    expect(hitPort(doc, world, radius)).toEqual(expected)
  })

  it('looks at outputs when asked', () => {
    expect(hitPort(doc, { x: 240, y: 24 }, 14, 'out')).toEqual({
      node: 'src',
      port: 'out'
    })
  })
})

describe('screenToWorld', () => {
  it('undoes the camera pan and zoom', () => {
    expect(
      screenToWorld({ x: 250, y: 130 }, { x: 50, y: 30, zoom: 2 })
    ).toEqual({ x: 100, y: 50 })
  })
})

describe('fitView', () => {
  it('returns the identity camera for an empty graph', () => {
    expect(fitView(docWith([]), { width: 800, height: 600 })).toEqual({
      x: 0,
      y: 0,
      zoom: 1
    })
  })

  it('keeps every node inside the viewport', () => {
    const doc = docWith([
      placed(ioNode('a', 'image'), -900, -300),
      placed(ioNode('b', 'image'), 1500, 900)
    ])
    const viewport = { width: 800, height: 600 }
    const camera = fitView(doc, viewport)
    const left = camera.x + -900 * camera.zoom
    const top = camera.y + (-300 - 28) * camera.zoom
    const right = camera.x + (1500 + 240) * camera.zoom
    const bottom = camera.y + (900 + 260) * camera.zoom
    expect(left).toBeGreaterThanOrEqual(0)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(right).toBeLessThanOrEqual(viewport.width)
    expect(bottom).toBeLessThanOrEqual(viewport.height)
  })

  it('never zooms in past 100% for a small graph', () => {
    const doc = docWith([placed(ioNode('a', 'image'), 0, 0)])
    expect(fitView(doc, { width: 2000, height: 2000 }).zoom).toBe(1)
  })
})

describe('cardMinHeight', () => {
  it.for([
    { rows: 0, expected: 48 },
    { rows: 1, expected: 48 },
    { rows: 3, expected: 104 }
  ])('fits $rows port rows in $expected px', ({ rows, expected }) => {
    expect(cardMinHeight(rows)).toBe(expected)
  })
})
