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

  // Older graphs name a link's ends `source_*`, and a hand-edited one can
  // leave a slot off entirely; both still have to draw.
  it.for([
    [
      'source_* names',
      { source_id: 1, source_slot: 0, target_id: 2, target_slot: 0 }
    ],
    ['no slots at all', { origin_id: 1, target_id: 2 }]
  ] as const)('reads a link written with %s', ([, link]) => {
    const { links } = readGraphPicture({
      nodes: [loader, sampler],
      links: [link]
    })

    expect(links).toHaveLength(1)
    expect(links[0].color).toBe(colorForType('IMAGE'))
  })

  it.for([
    ['no target', { origin_id: 1 }],
    ['no origin', { target_id: 2 }]
  ] as const)('drops a link with %s', ([, link]) => {
    expect(
      readGraphPicture({ nodes: [loader, sampler], links: [link] }).links
    ).toEqual([])
  })

  // A slot the link points past has no drawn dot to leave from, so the curve
  // falls back to where that row would have been rather than vanishing.
  it('anchors a link that names a slot the node does not have', () => {
    const { links } = readGraphPicture({
      nodes: [loader, sampler],
      links: [[1, 1, 3, 2, 3, 'IMAGE']]
    })

    expect(links).toHaveLength(1)
    expect(links[0].color).toBe(colorForType('IMAGE'))
    expect(links[0].y1).toBeGreaterThan(0)
  })

  it('reads a position saved as an object rather than a pair', () => {
    const [node] = readGraphPicture({
      nodes: [{ ...loader, pos: { 0: 40, 1: 90 } }]
    }).nodes

    expect([node.x, node.y]).toEqual([40, 90])
  })

  // A node saved without a size still has to be tall enough for its rows.
  it('gives a node with no size room for its slots', () => {
    const [node] = readGraphPicture({
      nodes: [{ ...sampler, size: undefined }]
    }).nodes

    expect(node.width).toBe(180)
    expect(node.height).toBeGreaterThan(50)
  })

  it('falls back to the type where a slot carries no name', () => {
    const [node] = readGraphPicture({
      nodes: [{ ...loader, outputs: [{ type: 'LATENT' }] }]
    }).nodes

    expect(node.outputs[0].name).toBe('LATENT')
    expect(node.accent).toBe(colorForType('LATENT'))
  })

  it.for([
    ['a slot that is not an object', [1]],
    ['a slot with neither name nor type', [{}]],
    ['slots that are not a list', 'nope']
  ] as const)('reads %s as no slots', ([, outputs]) => {
    const [node] = readGraphPicture({ nodes: [{ ...loader, outputs }] }).nodes

    expect(node.outputs).toEqual([])
    expect(node.accent).toBe(colorForType(undefined))
  })

  it('reads an id the graph saved as a string', () => {
    const { links } = readGraphPicture({
      nodes: [
        { ...loader, id: 'a' },
        { ...sampler, id: 'b' }
      ],
      links: [[1, 'a', 0, 'b', 0, 'IMAGE']]
    })

    expect(links).toHaveLength(1)
  })

  it.for([
    ['a position that is not a pair of numbers', { pos: ['a', 'b'] }],
    ['no position at all', { pos: undefined }]
  ] as const)('leaves a node out on %s', ([, overrides]) => {
    expect(
      readGraphPicture({ nodes: [{ ...loader, ...overrides }] }).nodes
    ).toEqual([])
  })

  it('falls back to a generic name where the node has neither', () => {
    const [node] = readGraphPicture({
      nodes: [{ id: 9, pos: [0, 0], title: '   ' }]
    }).nodes

    expect(node.title).toBe('Node')
  })

  it('drops a positional link whose slots are not numbers', () => {
    expect(
      readGraphPicture({
        nodes: [loader, sampler],
        links: [[1, 1, 'first', 2, 'first', 'IMAGE']]
      }).links
    ).toEqual([])
  })

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
