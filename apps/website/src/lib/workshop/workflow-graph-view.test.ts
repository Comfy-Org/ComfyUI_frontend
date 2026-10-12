import { describe, expect, it } from 'vitest'

import type { GraphNode, GraphPicture } from './workflow-graph'
import { openingView, readableScale } from './workflow-graph-view'

function node(id: string, x: number, wired: boolean): GraphNode {
  const slot = { index: 0, name: 'IMAGE', color: '#fff', y: 40 }
  return {
    id,
    title: id,
    x,
    y: 0,
    width: 200,
    height: 120,
    accent: '#fff',
    header: undefined,
    body: undefined,
    dimmed: false,
    inputs: wired ? [slot] : [],
    outputs: [],
    widgets: [],
    role: undefined,
    picture: undefined
  }
}

function picture(nodes: readonly GraphNode[]): GraphPicture {
  return { groups: [], nodes, links: [], viewBox: '0 0 2800 1300' }
}

describe('where a graph opens', () => {
  it('zooms a wide drawing until its node titles can be read', () => {
    // 14-unit titles fitted into 800px of an 2800-unit drawing land at 4px.
    expect(readableScale('0 0 2800 1300', 800, 512)).toBeCloseTo(2.75, 2)
  })

  it('leaves a drawing that already fits at its resting size', () => {
    expect(readableScale('0 0 600 400', 800, 512)).toBe(1)
  })

  it('accounts for a drawing constrained by the panel height', () => {
    expect(readableScale('0 0 600 2400', 800, 512)).toBe(3)
  })

  it.for([
    ['no panel to measure against', '0 0 2800 1300', 0],
    ['a viewBox it cannot read', 'not a viewbox', 800]
  ] as const)('rests when there is %s', ([, viewBox, panel]) => {
    expect(readableScale(viewBox, panel, 512)).toBe(1)
  })

  it('opens on the first node that takes something in', () => {
    // The note of install links a template leads with has no slots at all.
    const notes = node('notes', 0, false)
    const load = node('load', 900, true)
    const view = openingView(picture([load, notes]), 800, 512)

    // Where the drawing's transform carries a node's left edge.
    const centre = 2800 / 2
    const landed = (x: number) => view.panX + centre + view.scale * (x - centre)
    expect(landed(load.x)).toBeCloseTo(40, 5)
    expect(landed(notes.x)).toBeLessThan(0)
  })

  it('rests a drawing small enough to read whole', () => {
    const small: GraphPicture = {
      ...picture([node('a', 0, true)]),
      viewBox: '0 0 600 400'
    }
    expect(openingView(small, 800, 512)).toEqual({
      scale: 1,
      panX: 0,
      panY: 0
    })
  })

  it('rests when the drawing has no nodes', () => {
    expect(openingView(picture([]), 800, 512)).toEqual({
      scale: 1,
      panX: 0,
      panY: 0
    })
  })
})
