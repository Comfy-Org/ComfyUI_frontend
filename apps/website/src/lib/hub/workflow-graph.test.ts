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

const saver = {
  id: 3,
  type: 'SaveImage',
  pos: [800, 60],
  size: [200, 120],
  inputs: [{ name: 'images', type: 'IMAGE' }],
  outputs: []
}

// A template publishes its own before and after. Hanging them where they
// belong is what turns a diagram of boxes into a picture of this workflow.
describe('the template samples', () => {
  const pictures = (samples: readonly string[]) =>
    Object.fromEntries(
      readGraphPicture({ nodes: [loader, sampler, saver] }, samples).nodes.map(
        (node) => [node.title, node.picture?.href]
      )
    )

  it('hangs the before on what takes it and the after on what returns it', () => {
    expect(pictures(['before.webp', 'after.webp'])).toMatchObject({
      LoadImage: 'before.webp',
      SaveImage: 'after.webp',
      Sampler: undefined
    })
  })

  // Most templates publish the result alone, and a result standing in the
  // node that takes the input would be a lie about what goes in.
  it('gives a lone picture to the node that returns it', () => {
    expect(pictures(['result.webp'])).toMatchObject({
      LoadImage: undefined,
      SaveImage: 'result.webp'
    })
  })

  it('leaves every node bare when the template publishes nothing', () => {
    expect(pictures([])).toMatchObject({
      LoadImage: undefined,
      SaveImage: undefined
    })
  })

  // A node saved tall enough to show an image in the editor already has the
  // room, so the sample fills it rather than stretching the node past it.
  it.for([[200, 400] as const, [200, 60] as const])(
    'fits the sample inside a node saved %j',
    (size) => {
      const bare = readGraphPicture({ nodes: [{ ...saver, size }] }).nodes[0]
      const hung = readGraphPicture({ nodes: [{ ...saver, size }] }, ['a.webp'])
        .nodes[0]
      const picture = hung.picture!

      expect(hung.height).toBeGreaterThanOrEqual(bare.height)
      expect(picture.y + picture.height).toBeLessThanOrEqual(hung.height)
    }
  )

  it('leaves a node saved with the room it needs at that height', () => {
    const size = [200, 400] as const
    const bare = readGraphPicture({ nodes: [{ ...saver, size }] }).nodes[0]
    const hung = readGraphPicture({ nodes: [{ ...saver, size }] }, ['a.webp'])
      .nodes[0]

    expect(hung.height).toBe(bare.height)
  })
})

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

describe('the values a node carries', () => {
  // A node sized for its settings and drawn without them is the blank box the
  // graph was criticised for: the canvas reserves that space for the prompt,
  // the file and the numbers, which are what say what this graph will do.
  it('reads the saved values onto the node', () => {
    const [node] = readGraphPicture({
      nodes: [{ ...loader, size: [240, 220], widgets_values: ['dog.png', 7] }]
    }).nodes

    expect(node.widgets.map((widget) => widget.lines.join(' '))).toEqual([
      'dog.png',
      '7'
    ])
  })

  // Litegraph saves whatever the widget held, and a nested shape was never
  // something the canvas printed on the node's face.
  it('leaves out a value that was never a face value', () => {
    const [node] = readGraphPicture({
      nodes: [
        {
          ...loader,
          size: [240, 220],
          widgets_values: ['keep', { nested: true }, [1, 2], null, 2.5]
        }
      ]
    }).nodes

    expect(node.widgets.map((widget) => widget.lines.join(' '))).toEqual([
      'keep',
      '2.5'
    ])
  })

  it('stops at the bottom edge the graph gave the node', () => {
    const many = Array.from({ length: 30 }, (_, index) => `v${index}`)
    const [node] = readGraphPicture({
      nodes: [{ ...loader, size: [240, 140], widgets_values: many }]
    }).nodes

    expect(node.widgets.length).toBeLessThan(many.length)
    for (const widget of node.widgets)
      expect(widget.y + widget.height).toBeLessThanOrEqual(node.height)
  })

  // A note is a wall of text the canvas shows in full, and one clipped line of
  // it inside a tall empty box is the blank node all over again.
  it('fills the room a long value was given', () => {
    const prose = 'word '.repeat(200).trim()
    const [node] = readGraphPicture({
      nodes: [{ ...loader, size: [300, 400], widgets_values: [prose] }]
    }).nodes
    const [widget] = node.widgets

    expect(widget.lines.length).toBeGreaterThan(10)
    expect(widget.y + widget.height).toBeLessThanOrEqual(node.height)
    expect(widget.lines.at(-1)).toMatch(/…$/)
  })

  it('breaks mid-word only when a word cannot fit a line', () => {
    const [node] = readGraphPicture({
      nodes: [
        {
          ...loader,
          size: [200, 400],
          widgets_values: ['alpha beta gamma delta epsilon zeta eta theta']
        }
      ]
    }).nodes
    const [widget] = node.widgets

    expect(widget.lines.length).toBeGreaterThan(1)
    for (const line of widget.lines) expect(line).not.toMatch(/^\s|\s$/)
    expect(widget.lines.join(' ')).toBe(
      'alpha beta gamma delta epsilon zeta eta theta'
    )
  })

  it('grows a node the graph saved no room for', () => {
    const [node] = readGraphPicture({
      nodes: [{ ...loader, size: undefined, widgets_values: ['a', 'b', 'c'] }]
    }).nodes

    expect(node.widgets).toHaveLength(3)
  })
})

describe('what the graph chose for itself', () => {
  // Litegraph writes a colour either in full or in the three-digit short form,
  // and a node the author coloured is one they meant to stand apart.
  it.for([
    ['#432', '#443322'],
    ['#8b5cf6', '#8b5cf6'],
    ['nonsense', undefined],
    [undefined, undefined]
  ] as const)('reads %s as its header', ([saved, expected]) => {
    const [node] = readGraphPicture({
      nodes: [{ ...loader, color: saved }]
    }).nodes

    expect(node.header).toBe(expected)
  })

  // A node left in place without letting it run is still part of the picture.
  it.for([
    [0, false],
    [2, true],
    [4, true]
  ] as const)('dims a node in mode %s', ([mode, dimmed]) => {
    const [node] = readGraphPicture({ nodes: [{ ...loader, mode }] }).nodes

    expect(node.dimmed).toBe(dimmed)
  })

  it('reads the frames somebody drew around the graph', () => {
    const { groups, viewBox } = readGraphPicture({
      nodes: [loader],
      groups: [
        { title: 'Load', bounding: [-40, -60, 300, 240], color: '#3f6' },
        { bounding: 'not a box' }
      ]
    })

    expect(groups).toEqual([
      {
        id: 'g0',
        title: 'Load',
        x: -40,
        y: -60,
        width: 300,
        height: 240,
        color: '#33ff66'
      }
    ])
    // The frame reaches past the node it holds, so the picture makes room.
    expect(Number(viewBox.split(' ')[1])).toBeLessThan(-60)
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
