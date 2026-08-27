import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
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

const MAX_LINEAR_GROWTH = 2.05

describe('renderer geometry boundary complexity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
    LiteGraph.vueNodesMode = false
  })

  test(
    'keeps stable foreground and background boundary calls linear',
    { timeout: 20_000 },
    () => {
      const smaller = measureRenderCounts(250)
      const larger = measureRenderCounts(500)

      expect(smaller.visibleNodes).toBe(125)
      expect(larger.visibleNodes).toBe(250)
      expect(smaller.foreground.contentLookups).toBeGreaterThan(0)
      expect(smaller.background.contentLookups).toBeGreaterThan(0)
      expect(larger.foreground.contentLookups).toBeLessThanOrEqual(
        smaller.foreground.contentLookups * MAX_LINEAR_GROWTH
      )
      expect(larger.background.contentLookups).toBeLessThanOrEqual(
        smaller.background.contentLookups * MAX_LINEAR_GROWTH
      )
      expect(smaller.foreground.rectReads).toBe(0)
      expect(smaller.background.rectReads).toBe(0)
      expect(larger.foreground.rectReads).toBe(0)
      expect(larger.background.rectReads).toBe(0)
    }
  )
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
