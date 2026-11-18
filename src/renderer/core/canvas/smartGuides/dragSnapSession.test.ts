import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvas } from '@/utils/__tests__/canvasTestUtils'
import { createTestLink } from '@/utils/__tests__/litegraphTestUtils'

import { smartGuidesProvider } from './dragSnapSession'

function routedGraph() {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.pos = [0, 100]
  source.size = [150, 60]
  source.addOutput('out', 'STRING')
  graph.add(source)

  const target = new LGraphNode('Target')
  target.pos = [600, 900]
  target.size = [150, 60]
  target.addInput('in', 'STRING')
  graph.add(target)

  for (const node of [source, target]) node.updateArea()

  const link = createTestLink(graph, source, 0, target, 0)
  const reroute = graph.createReroute([300, source.getOutputPos(0)[1]], link)
  if (!reroute) throw new Error('Failed to create reroute')
  const canvas = createMockCanvas({
    graph,
    ds: { scale: 1 },
    visible_area: new Float32Array([-500, -500, 2000, 2000])
  })
  return { canvas, source, reroute }
}

describe('smartGuidesProvider.move', () => {
  it('snaps a node to straighten its wire to a fixed reroute', () => {
    const { canvas, source } = routedGraph()
    const snap = smartGuidesProvider.move(canvas, [source])
    expect(snap.offset({ x: 0, y: 5 }, { suspended: false }).y).toBe(0)
  })

  it('ignores the wire to a reroute that moves with the node', () => {
    const { canvas, source, reroute } = routedGraph()
    const snap = smartGuidesProvider.move(canvas, [source, reroute])
    expect(snap.offset({ x: 0, y: 5 }, { suspended: false }).y).toBe(5)
  })
})
