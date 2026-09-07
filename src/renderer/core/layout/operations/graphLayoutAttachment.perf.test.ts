import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { effect, stop } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { createMockCanvas2DContext } from '@/utils/__tests__/litegraphTestUtils'

type GeometryCounts = {
  contentLookups: number
  rectReads: number
}

type RenderCounts = {
  background: GeometryCounts
  foreground: GeometryCounts
  visibleNodes: number
}

describe('renderer geometry boundary complexity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
    LiteGraph.vueNodesMode = false
  })

  test(
    'avoids stable foreground and background geometry lookups',
    { timeout: 20_000 },
    () => {
      const smaller = measureRenderCounts(250)
      const larger = measureRenderCounts(500)

      expect(smaller.visibleNodes).toBe(125)
      expect(larger.visibleNodes).toBe(250)
      expect(smaller.foreground).toEqual({ contentLookups: 0, rectReads: 0 })
      expect(smaller.background).toEqual({ contentLookups: 0, rectReads: 0 })
      expect(larger.foreground).toEqual({ contentLookups: 0, rectReads: 0 })
      expect(larger.background).toEqual({ contentLookups: 0, rectReads: 0 })
    }
  )

  test('refreshes exactly once after a real geometry revision', () => {
    const { nodes } = createRenderer(245)
    const target = nodes[0]

    layoutStore.batchUpdateNodeBounds(
      target.graph!.rootGraph.id,
      [
        {
          nodeId: target.id,
          bounds: { x: 75, y: 80, width: 240, height: 100 }
        }
      ],
      { source: LayoutSource.Canvas }
    )

    const counts = countGeometryCalls(() => {
      expect([...target.pos]).toEqual([75, 80])
      expect([...target.size]).toEqual([240, 100])
      expect([...target.renderingSize]).toEqual([240, 100])
    })

    expect(counts).toEqual({ contentLookups: 1, rectReads: 1 })
  })

  test('invalidates measured content only when dimensions change', () => {
    const { nodes } = createRenderer(1)
    const node = nodes[0]
    const graphId = node.graph!.rootGraph.id

    layoutStore.reportContentSize(graphId, node.id, {
      width: 260,
      height: 120
    })
    expect(countGeometryCalls(() => void node.renderingSize[0])).toEqual({
      contentLookups: 1,
      rectReads: 0
    })
    expect([...node.renderingSize]).toEqual([260, 120])

    layoutStore.reportContentSize(graphId, node.id, {
      width: 260,
      height: 120
    })
    expect(countGeometryCalls(() => void node.renderingSize[0])).toEqual({
      contentLookups: 0,
      rectReads: 0
    })
  })

  test('subscribes implicit effects only to the observed node layout', () => {
    const { nodes } = createRenderer(2)
    const [node, other] = nodes
    let runs = 0
    let observed = [0, 0, 0, 0]
    const runner = effect(() => {
      runs++
      observed = [node.pos[0], node.pos[1], node.size[0], node.size[1]]
    })

    other.pos = [500, 600]
    expect(runs).toBe(1)

    node.pos = [150, 160]
    expect(runs).toBe(2)
    expect(observed).toEqual([150, 160, 200, 100])

    node.size = [240, 120]
    expect(runs).toBe(3)
    expect(observed).toEqual([150, 160, 240, 120])
    stop(runner)
  })

  test('keeps detached rendering size fresh', () => {
    const node = new LGraphNode('detached')
    node.size = [100, 50]
    expect([...node.renderingSize]).toEqual([100, 50])
    node.size[0] = 180
    node.size[1] = 90
    expect([...node.renderingSize]).toEqual([180, 90])
  })

  test('keeps stable mutation views fresh and extension-compatible', () => {
    const { nodes } = createRenderer(1)
    const node = nodes[0]
    const pos = node.pos
    const size = node.size

    node.pos = [30, 40]
    node.size = [220, 90]
    expect(node.pos).toBe(pos)
    expect(node.size).toBe(size)
    expect([...pos]).toEqual([30, 40])
    expect([...size]).toEqual([220, 90])

    pos[0] = 55
    size[1] = 105
    expect([...node.pos]).toEqual([55, 40])
    expect([...node.size]).toEqual([220, 105])
  })

  test('preserves widget-backed slot identity and reactive trigger behavior', () => {
    const { nodes } = createRenderer(1)
    const node = nodes[0]
    const widget = node.addWidget('text', 'value', '', null)
    const input = node.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    node._setConcreteSlots()

    let runs = 0
    const runner = effect(() => {
      runs++
      void input.pos
    })

    node.arrange()
    const firstPos = input.pos
    expect(firstPos).toBeDefined()
    expect(firstPos![1]).toBe(widget.y + 10)
    expect(runs).toBe(2)

    firstPos![0] = 33
    expect(input.pos).toBe(firstPos)
    expect(input.pos![0]).toBe(33)
    expect(runs).toBe(2)
    stop(runner)
  })
})

function measureRenderCounts(nodeCount: number): RenderCounts {
  const { canvas, context, nodes } = createRenderer(nodeCount)
  canvas.computeVisibleNodes(undefined, canvas.visible_nodes)
  for (const node of nodes) void node.renderingSize[0]

  vi.spyOn(canvas, 'drawNodeShape').mockImplementation(() => {})
  vi.spyOn(canvas, 'drawNodeWidgets').mockImplementation(() => {})
  vi.spyOn(canvas, 'renderLink').mockImplementation(() => {})
  vi.spyOn(LGraphNode.prototype, 'drawSlots').mockImplementation(() => {})

  const drawConnections = vi
    .spyOn(canvas, 'drawConnections')
    .mockImplementation(() => {})
  const foreground = countGeometryCalls(() => canvas.drawFrontCanvas())
  drawConnections.mockRestore()
  const background = countGeometryCalls(() => canvas.drawConnections(context))

  return {
    background,
    foreground,
    visibleNodes: canvas.visible_nodes.length
  }
}

function createRenderer(nodeCount: number): {
  canvas: LGraphCanvas
  context: CanvasRenderingContext2D
  nodes: LGraphNode[]
} {
  const context = createMockCanvas2DContext({
    bezierCurveTo: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    getTransform: vi.fn(() => new DOMMatrix()),
    measureText: vi.fn(() => ({ width: 50 }) as TextMetrics),
    quadraticCurveTo: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn()
  })
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 800
  canvasElement.height = 600
  canvasElement.getContext = vi.fn().mockReturnValue(context)
  canvasElement.getBoundingClientRect = vi.fn(() => new DOMRect(0, 0, 800, 600))

  const graph = new LGraph()
  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const node = new LGraphNode(`node-${index}`)
    node.pos = index % 2 === 0 ? [100, 100] : [2_000, 2_000]
    node.size = [200, 100]
    node.addInput('in', '*')
    node.addOutput('out', '*')
    graph.add(node)
    return node
  })
  for (let index = 1; index < nodes.length; index++) {
    nodes[index - 1].connect(0, nodes[index], 0)
  }

  const canvas = new LGraphCanvas(canvasElement, graph, { skip_render: true })
  canvas.visible_area.set([0, 0, 800, 600])
  return { canvas, context, nodes }
}

function countGeometryCalls(run: () => void): GeometryCounts {
  const contentSizeOf = vi.spyOn(layoutStore, 'contentSizeOf')
  const readNodeRect = vi.spyOn(layoutStore, 'readNodeRect')
  try {
    run()
    return {
      contentLookups: contentSizeOf.mock.calls.length,
      rectReads: readNodeRect.mock.calls.length
    }
  } finally {
    contentSizeOf.mockRestore()
    readNodeRect.mockRestore()
  }
}
