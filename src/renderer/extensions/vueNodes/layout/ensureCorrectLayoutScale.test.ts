import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphExtra } from '@/lib/litegraph/src/LGraph'
import type { Point, Rect } from '@/lib/litegraph/src/interfaces'
import { RENDER_SCALE_FACTOR } from '@/renderer/core/layout/transform/graphRenderTransform'

vi.mock('@/scripts/app', () => ({
  app: { canvas: undefined }
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
    nodes: fromAny<LGraph['nodes'], unknown>(nodes),
    groups: [],
    reroutes: new Map() as LGraph['reroutes'],
    extra
  }
  Object.defineProperty(graph, 'rootGraph', { get: () => graph })
  return graph
}

function twoNodeLayout(): MockNode[] {
  return [
    createNode('1', 100, 100, 120, 80),
    createNode('2', 320, 140, 100, 80)
  ]
}

function distanceBetweenNodes(nodes: MockNode[]): number {
  const [a, b] = nodes
  return Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1])
}

function snapshotGeometry(nodes: MockNode[]) {
  return nodes.map((n) => ({
    pos: [...n.pos] as [number, number],
    size: [...n.size] as [number, number]
  }))
}

describe('ensureCorrectLayoutScale (legacy normalizer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes legacy Vue-scaled graph once', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, {
      workflowRendererVersion: 'Vue'
    })

    const beforeDistance = distanceBetweenNodes(nodes)
    const result = ensureCorrectLayoutScale(undefined, graph as LGraph)

    expect(result).toBe(true)
    expect(graph.extra?.workflowRendererVersion).toBe('Vue-corrected')

    // Distance should shrink by 1/RENDER_SCALE_FACTOR
    const afterDistance = distanceBetweenNodes(nodes)
    expect(afterDistance / beforeDistance).toBeCloseTo(
      1 / RENDER_SCALE_FACTOR,
      5
    )
  })

  it('is idempotent — second call is a no-op', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, {
      workflowRendererVersion: 'Vue'
    })

    ensureCorrectLayoutScale(undefined, graph as LGraph)
    const afterFirst = snapshotGeometry(nodes)

    const result = ensureCorrectLayoutScale(undefined, graph as LGraph)
    expect(result).toBe(false)

    const afterSecond = snapshotGeometry(nodes)
    expect(afterSecond).toEqual(afterFirst)
  })

  it('does not re-normalize when graph is already marked Vue-corrected even with Vue override', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, {
      workflowRendererVersion: 'Vue-corrected'
    })

    const before = snapshotGeometry(nodes)
    const result = ensureCorrectLayoutScale('Vue', graph as LGraph)

    expect(result).toBe(false)
    expect(snapshotGeometry(nodes)).toEqual(before)
  })

  it('uses renderer override when workflow metadata is missing', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes)

    const beforeDistance = distanceBetweenNodes(nodes)
    const result = ensureCorrectLayoutScale('Vue', graph as LGraph)

    expect(result).toBe(true)
    expect(graph.extra?.workflowRendererVersion).toBe('Vue-corrected')
    const afterDistance = distanceBetweenNodes(nodes)
    expect(afterDistance / beforeDistance).toBeCloseTo(
      1 / RENDER_SCALE_FACTOR,
      5
    )
  })

  it('is a no-op for already-corrected graphs', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, {
      workflowRendererVersion: 'Vue-corrected'
    })

    const before = snapshotGeometry(nodes)
    const result = ensureCorrectLayoutScale(undefined, graph as LGraph)

    expect(result).toBe(false)
    expect(snapshotGeometry(nodes)).toEqual(before)
  })

  it('is a no-op for LG metadata', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, {
      workflowRendererVersion: 'LG'
    })

    const before = snapshotGeometry(nodes)
    const result = ensureCorrectLayoutScale(undefined, graph as LGraph)

    expect(result).toBe(false)
    expect(snapshotGeometry(nodes)).toEqual(before)
  })

  it('is a no-op for missing metadata', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes)

    const before = snapshotGeometry(nodes)
    const result = ensureCorrectLayoutScale(undefined, graph as LGraph)

    expect(result).toBe(false)
    expect(snapshotGeometry(nodes)).toEqual(before)
  })

  it('skips null subgraph IO nodes', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, {
      workflowRendererVersion: 'Vue'
    }) as LGraph & {
      inputNode: null
      outputNode: null
    }

    graph.inputNode = null
    graph.outputNode = null

    expect(() => ensureCorrectLayoutScale(undefined, graph)).not.toThrow()
    expect(graph.extra?.workflowRendererVersion).toBe('Vue-corrected')
  })

  it('normalizes reroutes', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, {
      workflowRendererVersion: 'Vue'
    })

    const reroute = { id: 1, pos: [200, 200] as Point, linkIds: new Set([1]) }
    ;(graph.reroutes as Map<number, typeof reroute>).set(1, reroute)

    ensureCorrectLayoutScale(undefined, graph as LGraph)

    // createBounds adds 10px padding, so anchor is (90, 90)
    // Reroute at (200, 200). Relative: (110, 110). Downscaled: 110/1.2 ≈ 91.67
    // Final: 90 + 91.67 ≈ 181.67
    const anchor = 90 // min node pos (100) - createBounds padding (10)
    const relative = 200 - anchor
    expect(reroute.pos[0]).toBeCloseTo(
      anchor + relative / RENDER_SCALE_FACTOR,
      5
    )
    expect(reroute.pos[1]).toBeCloseTo(
      anchor + relative / RENDER_SCALE_FACTOR,
      5
    )
  })

  it('normalizes groups', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, {
      workflowRendererVersion: 'Vue'
    })

    const group = {
      pos: [150, 150] as Point,
      size: [300, 200] as Point
    }
    ;(graph.groups as (typeof group)[]).push(group)

    ensureCorrectLayoutScale(undefined, graph as LGraph)

    expect(group.size[0]).toBeCloseTo(300 / RENDER_SCALE_FACTOR, 5)
    expect(group.size[1]).toBeCloseTo(200 / RENDER_SCALE_FACTOR, 5)
  })

  it('updates group geometry in place without replacing arrays', () => {
    const nodes = twoNodeLayout()
    const graph = createMockGraph(nodes, {
      workflowRendererVersion: 'Vue'
    })

    const groupPos = [150, 150] as Point
    const groupSize = [300, 200] as Point
    const group = {
      pos: groupPos,
      size: groupSize
    }
    ;(graph.groups as (typeof group)[]).push(group)

    ensureCorrectLayoutScale(undefined, graph as LGraph)

    expect(group.pos).toBe(groupPos)
    expect(group.size).toBe(groupSize)
  })

  it('repeated normalization does not compound spacing', () => {
    const distances: number[] = []

    for (let i = 0; i < 5; i++) {
      const nodes = twoNodeLayout()
      const graph = createMockGraph(nodes, {
        workflowRendererVersion: 'Vue'
      })

      ensureCorrectLayoutScale(undefined, graph as LGraph)
      distances.push(distanceBetweenNodes(nodes))
    }

    // All runs should produce the same distance
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i] / distances[0]).toBeCloseTo(1, 5)
    }
  })
})
