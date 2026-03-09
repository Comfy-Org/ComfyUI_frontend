import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LGraph,
  LGraphExtra,
  RendererType
} from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { Point, Rect } from '@/lib/litegraph/src/interfaces'

const mockState = vi.hoisted(() => ({
  autoScaleEnabled: true,
  shouldRenderVueNodes: true,
  app: {
    canvas: undefined as Partial<LGraphCanvas> | undefined
  }
}))

const mockLayoutStore = vi.hoisted(() => ({
  setSource: vi.fn(),
  batchUpdateNodeBounds: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.VueNodes.AutoScaleLayout'
        ? mockState.autoScaleEnabled
        : undefined
  })
}))

vi.mock('@/composables/useVueFeatureFlags', () => ({
  useVueFeatureFlags: () => ({
    shouldRenderVueNodes: {
      get value() {
        return mockState.shouldRenderVueNodes
      }
    }
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: mockLayoutStore
}))

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: () => ({
    moveReroute: vi.fn()
  })
}))

vi.mock('@/scripts/app', () => ({
  app: mockState.app
}))

import { ensureCorrectLayoutScale } from './ensureCorrectLayoutScale'

function createNode(id: string, x: number, y: number, w: number, h: number) {
  return {
    id,
    pos: [x, y] as Point,
    size: [w, h] as Point,
    get width() {
      return this.size[0]
    },
    set width(v: number) {
      this.size[0] = v
    },
    get boundingRect(): Rect {
      return [this.pos[0], this.pos[1], this.size[0], this.size[1]]
    }
  }
}

type MockNode = ReturnType<typeof createNode>

function createMockGraph(
  nodes: MockNode[],
  extra: LGraphExtra = {}
): Partial<LGraph> {
  const graph: Partial<LGraph> = {
    id: crypto.randomUUID(),
    nodes: nodes as unknown as LGraph['nodes'],
    groups: [],
    reroutes: new Map() as LGraph['reroutes'],
    extra
  }
  Object.defineProperty(graph, 'rootGraph', { get: () => graph })
  return graph
}

function createMockCanvas(graph: Partial<LGraph>): Partial<LGraphCanvas> {
  let scale = 1
  return {
    graph: graph as LGraph,
    ds: {
      get scale() {
        return scale
      },
      set scale(v: number) {
        scale = v
      },
      convertOffsetToCanvas: (point: Point) => point,
      changeScale: (v: number) => {
        scale = v
      }
    } as unknown as LGraphCanvas['ds']
  }
}

function distanceBetweenNodes(nodes: MockNode[]): number {
  const [a, b] = nodes
  return Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1])
}

function twoNodeLayout(): MockNode[] {
  return [
    createNode('1', 100, 100, 120, 80),
    createNode('2', 320, 140, 100, 80)
  ]
}

describe('ensureCorrectLayoutScale', () => {
  beforeEach(() => {
    mockState.autoScaleEnabled = true
    mockState.shouldRenderVueNodes = true
    mockState.app.canvas = undefined
    vi.clearAllMocks()
  })

  it('is idempotent — calling multiple times does not compound spacing', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, { workflowRendererVersion: 'LG' })
    mockState.app.canvas = createMockCanvas(graph)

    const beforeDistance = distanceBetweenNodes(nodes)

    ensureCorrectLayoutScale('LG', graph as LGraph)
    const firstDistance = distanceBetweenNodes(nodes)

    ensureCorrectLayoutScale('LG', graph as LGraph)
    const secondDistance = distanceBetweenNodes(nodes)

    expect(firstDistance / beforeDistance).toBeCloseTo(1.2, 5)
    expect(secondDistance / firstDistance).toBeCloseTo(1, 5)
  })

  it('stays stable across reloads even when renderer metadata is lost', () => {
    const distances: number[] = []
    let savedNodes = twoNodeLayout()
    let savedExtra: LGraphExtra = {}

    for (let i = 0; i < 3; i++) {
      const nodes = twoNodeLayout().map((n, j) => {
        n.pos = [...savedNodes[j].pos] as Point
        n.size = [...savedNodes[j].size] as Point
        return n
      })
      const graph = createMockGraph(nodes, { ...savedExtra })
      mockState.app.canvas = createMockCanvas(graph)

      ensureCorrectLayoutScale(undefined, graph as LGraph)

      distances.push(distanceBetweenNodes(nodes))

      // Persist positions but drop renderer metadata
      savedNodes = nodes
      savedExtra = {}
    }

    // First load scales up, subsequent loads should not compound
    expect(distances[1] / distances[0]).toBeCloseTo(1, 5)
    expect(distances[2] / distances[1]).toBeCloseTo(1, 5)
  })

  it('stays stable across reloads when renderer metadata is preserved', () => {
    const distances: number[] = []
    let savedNodes = twoNodeLayout()
    let savedRenderer: RendererType | undefined = 'Vue'

    for (let i = 0; i < 3; i++) {
      const nodes = twoNodeLayout().map((n, j) => {
        n.pos = [...savedNodes[j].pos] as Point
        n.size = [...savedNodes[j].size] as Point
        return n
      })
      const extra: LGraphExtra = savedRenderer
        ? { workflowRendererVersion: savedRenderer }
        : {}
      const graph = createMockGraph(nodes, extra)
      mockState.app.canvas = createMockCanvas(graph)

      ensureCorrectLayoutScale(savedRenderer, graph as LGraph)

      distances.push(distanceBetweenNodes(nodes))

      savedNodes = nodes
      savedRenderer = graph.extra?.workflowRendererVersion
    }

    expect(distances[1] / distances[0]).toBeCloseTo(1, 5)
    expect(distances[2] / distances[1]).toBeCloseTo(1, 5)
  })

  it('scales up then down to return to original positions', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, { workflowRendererVersion: 'LG' })
    mockState.app.canvas = createMockCanvas(graph)

    const beforeDistance = distanceBetweenNodes(nodes)

    ensureCorrectLayoutScale('LG', graph as LGraph)

    mockState.shouldRenderVueNodes = false
    ensureCorrectLayoutScale('Vue', graph as LGraph)

    const finalDistance = distanceBetweenNodes(nodes)
    expect(finalDistance / beforeDistance).toBeCloseTo(1, 5)
  })

  it('does nothing when renderer is unknown and graph has no metadata', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes)
    mockState.app.canvas = createMockCanvas(graph)

    const beforeDistance = distanceBetweenNodes(nodes)

    ensureCorrectLayoutScale(undefined, graph as LGraph)

    expect(distanceBetweenNodes(nodes)).toBe(beforeDistance)
  })
})
