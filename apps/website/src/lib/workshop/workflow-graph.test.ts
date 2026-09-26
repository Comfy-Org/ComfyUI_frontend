import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { GraphNode } from './workflow-graph'
import { linkPath, readGraphPicture } from './workflow-graph'

const GRAPHS = join(process.cwd(), 'public/workflow-graphs')

const published = readdirSync(GRAPHS).filter((name) => name.endsWith('.json'))

const graphOf = (name: string) =>
  JSON.parse(readFileSync(`${GRAPHS}/${name}`, 'utf8')) as unknown

const BEFORE = 'https://media.example.com/before.png'
const AFTER = 'https://media.example.com/after.png'

describe('readGraphPicture', () => {
  // The reader is only worth anything if it reads the graphs this site
  // actually publishes, so the fixtures are those graphs rather than a hand
  // written one that cannot go stale in the same way.
  it.for(published)('draws %s', (name) => {
    const picture = readGraphPicture(graphOf(name))

    expect(picture.nodes.length).toBeGreaterThan(0)
    expect(picture.viewBox).toMatch(/^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/)
    for (const node of picture.nodes) {
      expect(node.width).toBeGreaterThan(0)
      expect(node.height).toBeGreaterThan(0)
    }
    // Every link joins two nodes the picture holds, or it is a line to
    // nowhere.
    for (const link of picture.links)
      for (const end of [link.x1, link.y1, link.x2, link.y2])
        expect(Number.isFinite(end)).toBe(true)
  })

  // Anything but a graph is a graph with nothing in it, not a throw: the page
  // fetches this from the network and has to draw something either way.
  it.for([undefined, null, 42, 'graph', {}, { nodes: 'none' }])(
    'reads %s as an empty picture',
    (source) => {
      const picture = readGraphPicture(source)

      expect(picture.nodes).toEqual([])
      expect(picture.links).toEqual([])
      expect(picture.groups).toEqual([])
    }
  )

  it('keeps a node the graph drew in its own colours', () => {
    const picture = readGraphPicture({
      nodes: [
        {
          id: 1,
          type: 'SaveImage',
          pos: [0, 0],
          size: [200, 100],
          color: '#123456',
          bgcolor: '#abc'
        }
      ]
    })

    expect(picture.nodes[0]?.header).toBe('#123456')
    expect(picture.nodes[0]?.body).toBe('#aabbcc')
  })

  it('fades a node the graph muted rather than dropping it', () => {
    const picture = readGraphPicture({
      nodes: [
        { id: 1, type: 'SaveImage', pos: [0, 0], size: [200, 100], mode: 2 }
      ]
    })

    expect(picture.nodes[0]?.dimmed).toBe(true)
  })
})

describe('the template’s own samples', () => {
  const withSamples = (samples: readonly string[]) =>
    readGraphPicture(graphOf('animate-reference-sheet.json'), samples)

  const hung = (nodes: readonly GraphNode[]) =>
    nodes.filter((node) => node.picture)

  it('hangs the result in the node that hands it back', () => {
    const picture = withSamples([AFTER])

    expect(hung(picture.nodes).map((node) => node.picture?.href)).toEqual([
      AFTER
    ])
    expect(hung(picture.nodes)[0]?.role).toBe('output')
  })

  // One picture is the result. Two are a before and an after, and the before
  // belongs where the run takes it in.
  it('hangs a before at the way in and an after at the way out', () => {
    const picture = withSamples([BEFORE, AFTER])
    const held = hung(picture.nodes)

    expect(held).toHaveLength(2)
    expect(held.find((node) => node.role === 'input')?.picture?.href).toBe(
      BEFORE
    )
    expect(held.find((node) => node.role === 'output')?.picture?.href).toBe(
      AFTER
    )
  })

  it('hangs nothing when the template has no pictures', () => {
    expect(hung(withSamples([]).nodes)).toEqual([])
  })
})

// The preview is meant to read like the editor, so a wire carries the colour
// the editor gives its kind, and a kind the editor has since added is grey
// rather than absent.
describe('the colours a kind is drawn in', () => {
  const slotOf = (type: string) =>
    readGraphPicture({
      nodes: [
        {
          id: 1,
          type: 'Node',
          pos: [0, 0],
          size: [200, 100],
          inputs: [{ name: 'in', type }]
        }
      ]
    }).nodes[0]?.inputs[0]

  it.for([
    ['IMAGE', '#64b5f6'],
    ['image', '#64b5f6'],
    ['MODEL', '#b39ddb'],
    ['SOMETHING_NEW', '#8b8b8b']
  ] as const)('draws %s in %s', ([type, color]) => {
    expect(slotOf(type).color).toBe(color)
  })
})

describe('linkPath', () => {
  it('leaves one end and arrives at the other', () => {
    const path = linkPath({
      id: 'l1',
      color: '#fff',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 50
    })

    expect(path.startsWith('M 0 0')).toBe(true)
    expect(path.endsWith('100 50')).toBe(true)
  })
})
