import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'
import { createTestLink } from '@/utils/__tests__/litegraphTestUtils'

function createCanvas(graph: LGraph): LGraphCanvas {
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 800
  canvasElement.height = 600
  const foregroundContext = createMockCanvasRenderingContext2D()
  Object.defineProperty(foregroundContext, 'canvas', { value: canvasElement })
  canvasElement.getContext = vi.fn().mockReturnValue(foregroundContext)
  canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })

  const canvas = new LGraphCanvas(canvasElement, graph, {
    skip_render: true,
    skip_events: true
  })
  const backgroundContext = createMockCanvasRenderingContext2D()
  Object.defineProperty(backgroundContext, 'canvas', {
    value: canvas.bgcanvas
  })
  canvas.bgctx = backgroundContext
  return canvas
}

describe('LGraphCanvas camera settling in Vue nodes mode', () => {
  let previousVueNodesMode: boolean
  let now: number

  beforeEach(() => {
    previousVueNodesMode = LiteGraph.vueNodesMode
    LiteGraph.vueNodesMode = true
    layoutStore.resetForTests()
    now = 0
    vi.spyOn(LiteGraph, 'getTime').mockImplementation(() => now)
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = previousVueNodesMode
  })

  it('repairs widget input sockets and link endpoints after the camera stops', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.pos = [0, 100]
    source.size = [150, 60]
    source.addOutput('out', 'STRING')
    graph.add(source)

    const target = new LGraphNode('Target')
    target.pos = [300, 100]
    target.size = [200, 200]
    const upper = target.addWidget('text', 'upper', '', null)
    target.addWidget('text', 'lower', '', null)
    target.addInput('lower', 'STRING').widget = { name: 'lower' }
    graph.add(target)
    const link = createTestLink(graph, source, 0, target, 0)

    const canvas = createCanvas(graph)
    const renderLink = vi
      .spyOn(canvas, 'renderLink')
      .mockImplementation(() => {})
    const drawnLinkEnd = () =>
      renderLink.mock.calls.findLast(([, , , drawn]) => drawn === link)?.[2]

    canvas.draw(true, true)
    expect(target.getInputPos(0)).toEqual([300, 136])
    expect(drawnLinkEnd()).toEqual([300, 136])

    for (now = 16; now <= 48; now += 16) {
      canvas.ds.offset[0] += 10
      canvas.setDirty(true, true)
      canvas.draw()
    }
    upper.computeSize = () => [100, 60]
    for (now = 64; now <= 96; now += 16) {
      canvas.ds.offset[0] += 10
      canvas.setDirty(true, true)
      canvas.draw()
    }

    for (now = 112; now <= 400; now += 16) canvas.draw()

    expect(target.getInputPos(0)).toEqual([300, 176])
    expect(drawnLinkEnd()).toEqual([300, 176])
  })
})
