import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement
} from '@/utils/__tests__/canvasTestUtils'
import { createTestLink } from '@/utils/__tests__/litegraphTestUtils'

let now = 0

function createCanvas(graph: LGraph): LGraphCanvas {
  const foregroundContext = createMockCanvasRenderingContext2D()
  const canvasElement = createTestCanvasElement({
    ctx: foregroundContext,
    cssSize: [800, 600]
  })
  Object.defineProperty(foregroundContext, 'canvas', { value: canvasElement })

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

function panFrames(canvas: LGraphCanvas, times: number[], step = 10): void {
  for (const time of times) {
    now = time
    canvas.ds.offset[0] += step
    canvas.setDirty(true, true)
    canvas.draw()
  }
}

function idleFramesUntil(canvas: LGraphCanvas, end: number): void {
  while (now + 16 <= end) {
    now += 16
    canvas.draw()
  }
}

describe('LGraphCanvas camera settling in Vue nodes mode', () => {
  let previousVueNodesMode: boolean

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

  function createLinkedWidgetInput() {
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

    return { canvas, graph, target, upper, renderLink, drawnLinkEnd }
  }

  it('repairs widget input sockets and link endpoints after the camera stops', () => {
    const { canvas, target, upper, drawnLinkEnd } = createLinkedWidgetInput()

    canvas.draw(true, true)
    expect(target.getInputPos(0)).toEqual([300, 136])
    expect(drawnLinkEnd()).toEqual([300, 136])

    panFrames(canvas, [16, 32, 48])
    upper.computeSize = () => [100, 60]
    panFrames(canvas, [64, 80, 96])
    idleFramesUntil(canvas, 400)

    expect(target.getInputPos(0)).toEqual([300, 176])
    expect(drawnLinkEnd()).toEqual([300, 176])
  })

  it('repairs a node that the pan moved out of view before the camera stops', () => {
    const { canvas, target, upper, renderLink, drawnLinkEnd } =
      createLinkedWidgetInput()

    canvas.draw(true, true)
    panFrames(canvas, [16, 32, 48])
    upper.computeSize = () => [100, 60]
    panFrames(canvas, [64, 80, 96])
    panFrames(canvas, [112], 520)
    expect(canvas.visible_nodes).not.toContain(target)
    renderLink.mockClear()
    idleFramesUntil(canvas, 800)

    expect(target.getInputPos(0)).toEqual([300, 176])
    expect(drawnLinkEnd()).toEqual([300, 176])
  })

  it('repairs a skipped node after the camera stopped on another graph', () => {
    const { canvas, graph, target, upper, renderLink, drawnLinkEnd } =
      createLinkedWidgetInput()

    canvas.draw(true, true)
    panFrames(canvas, [16, 32, 48])
    upper.computeSize = () => [100, 60]
    panFrames(canvas, [64, 80, 96])
    panFrames(canvas, [112], 520)
    canvas.setGraph(new LGraph())
    idleFramesUntil(canvas, 400)
    canvas.setGraph(graph)
    expect(canvas.visible_nodes).not.toContain(target)
    renderLink.mockClear()
    idleFramesUntil(canvas, 800)

    expect(target.getInputPos(0)).toEqual([300, 176])
    expect(drawnLinkEnd()).toEqual([300, 176])
  })

  it('repairs a skipped node after Vue nodes mode was turned off', () => {
    const { canvas, target, upper } = createLinkedWidgetInput()

    canvas.draw(true, true)
    panFrames(canvas, [16, 32, 48])
    upper.computeSize = () => [100, 60]
    panFrames(canvas, [64, 80, 96])
    panFrames(canvas, [112], 520)
    LiteGraph.vueNodesMode = false
    idleFramesUntil(canvas, 400)
    LiteGraph.vueNodesMode = true
    canvas.setDirty(true, true)
    idleFramesUntil(canvas, 800)

    expect(target.getInputPos(0)).toEqual([300, 176])
  })
})
