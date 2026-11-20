import { describe, expect, it } from 'vitest'

import { LGraph, LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvas } from '@/utils/__tests__/canvasTestUtils'
import { createTestLink } from '@/utils/__tests__/litegraphTestUtils'

import {
  createSmartGuidesProvider,
  nodePlacement,
  positionForBox
} from './dragSnapSession'
import type { SmartGuidesConfig } from './dragSnapSession'

const defaults: SmartGuidesConfig = {
  enabled: true,
  edges: true,
  wires: true,
  spacing: true,
  distance: 8,
  gap: 0
}

const wiresOnly = { ...defaults, edges: false, spacing: false }

const providerWith = (config: SmartGuidesConfig) =>
  createSmartGuidesProvider(() => config)

const free = { snapToGrid: false }

function canvasFor(graph: LGraph, scale = 1) {
  return createMockCanvas({
    graph,
    ds: { scale },
    visible_area: new Float32Array([-1000, -1000, 3000, 3000])
  })
}

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
  return { canvas: canvasFor(graph), source, reroute }
}

function groupScene() {
  const graph = new LGraph()
  const group = new LGraphGroup('G')
  group.pos = [0, 0]
  group.size = [400, 400]
  graph.add(group)

  const child = new LGraphNode('Child')
  child.pos = [50, 100]
  child.size = [150, 60]
  child.addInput('in', 'STRING')
  graph.add(child)

  const dragged = new LGraphNode('Dragged')
  dragged.pos = [600, 105]
  dragged.size = [150, 60]
  dragged.addOutput('out', 'STRING')
  graph.add(dragged)

  const outside = new LGraphNode('Outside')
  outside.pos = [-400, 103]
  outside.size = [150, 60]
  outside.addOutput('out', 'STRING')
  graph.add(outside)

  for (const node of [child, dragged, outside]) node.updateArea()
  group.recomputeInsideNodes()
  return { graph, group, child, dragged, outside, canvas: canvasFor(graph) }
}

describe('createSmartGuidesProvider move', () => {
  it('snaps a node to straighten its wire to a fixed reroute', () => {
    const { canvas, source } = routedGraph()
    const snap = providerWith(defaults).move(canvas, [source])
    expect(snap?.offset({ x: 0, y: 5 }, free).y).toBe(0)
  })

  it('ignores the wire to a reroute that moves with the node', () => {
    const { canvas, source, reroute } = routedGraph()
    const snap = providerWith(defaults).move(canvas, [source, reroute])
    expect(snap?.offset({ x: 0, y: 5 }, free).y).toBe(5)
  })

  it('leaves the offset alone while grid snapping is held', () => {
    const { canvas, source } = routedGraph()
    const snap = providerWith(defaults).move(canvas, [source])
    expect(snap?.offset({ x: 0, y: 5 }, { snapToGrid: true }).y).toBe(5)
  })

  it('measures the snap distance in screen pixels', () => {
    const { canvas, source } = routedGraph()
    canvas.ds.scale = 2
    const snap = providerWith(defaults).move(canvas, [source])
    expect(snap?.offset({ x: 0, y: 5 }, free).y).toBe(5)
    expect(snap?.offset({ x: 0, y: 3 }, free).y).toBe(0)
  })

  it('does not snap when disabled', () => {
    const { canvas, source } = routedGraph()
    expect(
      providerWith({ ...defaults, enabled: false }).move(canvas, [source])
    ).toBeUndefined()
  })

  it('treats the children of a group dragged without them as fixed targets', () => {
    const { graph, group, child, dragged, canvas } = groupScene()
    createTestLink(graph, dragged, 0, child, 0)
    const snap = providerWith(wiresOnly).move(canvas, [dragged, group])
    expect(snap?.offset({ x: 0, y: 0 }, free).y).toBe(-5)
  })

  it('ignores wires between stationary nodes when only the group moves', () => {
    const { graph, group, child, dragged, outside, canvas } = groupScene()
    createTestLink(graph, outside, 0, child, 0)
    const snap = providerWith(wiresOnly).move(canvas, [dragged, group])
    expect(snap?.offset({ x: 0, y: 0 }, free).y).toBe(0)
  })
})

describe('createSmartGuidesProvider resize', () => {
  it('snaps a resized group edge to a node inside it', () => {
    const { group, canvas } = groupScene()
    const snap = providerWith(defaults).resize(canvas, group)
    const out = snap?.resize(
      { x: 0, y: 0, width: 205, height: 400 },
      'SE',
      free
    )
    expect(out?.width).toBe(200)
  })
})

describe('positionForBox', () => {
  it('keeps the offset an onBounding hook adds between position and box', () => {
    const node = new LGraphNode('Padded')
    node.pos = [100, 200]
    node.size = [150, 60]
    node.onBounding = (bounds) => {
      bounds[0] -= 10
    }
    node.updateArea()
    const placement = nodePlacement(node)

    const moved = {
      ...placement.box,
      x: placement.box.x + 30,
      y: placement.box.y + 5
    }
    expect(positionForBox(placement, moved)).toEqual({ x: 130, y: 205 })
  })
})
