import { describe, expect, it } from 'vitest'

import {
  colorForType,
  linkPath,
  readGraphPicture,
  viewBoxFor
} from './workflow-graph'

const loader = {
  id: 1,
  type: 'LoadImage',
  pos: [0, 0],
  size: [200, 120],
  inputs: [],
  outputs: [{ name: 'IMAGE', type: 'IMAGE' }]
}
const sampler = {
  id: 2,
  type: 'KSampler',
  title: 'Sampler',
  pos: [400, 60],
  size: [220, 160],
  inputs: [{ name: 'image', type: 'IMAGE' }],
  outputs: [{ name: 'LATENT', type: 'LATENT' }]
}

describe('readGraphPicture', () => {
  it('reads a saved title over the class name', () => {
    const { nodes } = readGraphPicture({ nodes: [loader, sampler] })

    expect(nodes.map((node) => node.title)).toEqual(['LoadImage', 'Sampler'])
  })

  it.for([
    ['positional', [[7, 1, 0, 2, 0, 'IMAGE']]],
    [
      'object',
      [{ id: 7, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0 }]
    ]
  ] as const)('joins the two nodes from a %s link', ([, links]) => {
    const { links: drawn } = readGraphPicture({
      nodes: [loader, sampler],
      links
    })

    expect(drawn).toHaveLength(1)
    // The curve leaves the loader's right edge and enters the sampler's left.
    expect(drawn[0].x1).toBe(200)
    expect(drawn[0].x2).toBe(400)
    expect(drawn[0].color).toBe(colorForType('IMAGE'))
  })

  it.for([
    ['a node it never saw', [[7, 1, 0, 99, 0, 'IMAGE']]],
    ['nothing at all', [[7]]]
  ] as const)('drops a link naming %s', ([, links]) => {
    expect(readGraphPicture({ nodes: [loader, sampler], links }).links).toEqual(
      []
    )
  })

  it.for([[undefined], [{}], [{ nodes: 'not a list' }]] as const)(
    'reads %o as an empty picture rather than throwing',
    ([source]) => {
      expect(readGraphPicture(source).nodes).toEqual([])
    }
  )

  it('leaves a node with no position out, having nowhere to draw it', () => {
    expect(
      readGraphPicture({ nodes: [{ id: 3, type: 'Note' }] }).nodes
    ).toEqual([])
  })
})

describe('viewBoxFor', () => {
  it('frames every node with room around them', () => {
    const { nodes, viewBox } = readGraphPicture({ nodes: [loader, sampler] })
    const [x, y, width, height] = viewBox.split(' ').map(Number)

    expect(x).toBeLessThan(0)
    expect(y).toBeLessThan(0)
    for (const node of nodes) {
      expect(node.x + node.width).toBeLessThan(x + width)
      expect(node.y + node.height).toBeLessThan(y + height)
    }
  })

  it('gives an empty graph a box to sit in', () => {
    expect(viewBoxFor([])).toBe('0 0 800 450')
  })
})

describe('linkPath', () => {
  it('leaves rightwards and arrives leftwards', () => {
    expect(
      linkPath({ id: 'a', color: '#fff', x1: 0, y1: 0, x2: 200, y2: 50 })
    ).toBe('M 0 0 C 100 0, 100 50, 200 50')
  })
})
