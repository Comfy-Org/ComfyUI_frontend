import { describe, expect, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphGroup } from '@/lib/litegraph/src/litegraph'
import * as colorUtil from '@/utils/colorUtil'

import { test } from './__fixtures__/testExtensions'

vi.mock('@/utils/colorUtil', async (importOriginal) => {
  const actual = await importOriginal<typeof colorUtil>()
  return { ...actual, textOnColor: vi.fn(actual.textOnColor) }
})

function createMockContext() {
  return {
    beginPath: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline
  } as unknown as CanvasRenderingContext2D
}

const graphCanvas = { editor_alpha: 1 } as Partial<LGraphCanvas> as LGraphCanvas

describe('LGraphGroup', () => {
  test('serializes to the existing format', () => {
    const link = new LGraphGroup('title', 929)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  describe('recomputeInsideNodes', () => {
    test('uses visited set to avoid redundant computation', () => {
      const graph = new LGraph()

      // Create 4 nested groups: outer -> mid1 -> mid2 -> inner
      const outer = new LGraphGroup('outer')
      outer.pos = [0, 0]
      outer.size = [400, 400]
      graph.add(outer)

      const mid1 = new LGraphGroup('mid1')
      mid1.pos = [10, 10]
      mid1.size = [300, 300]
      graph.add(mid1)

      const mid2 = new LGraphGroup('mid2')
      mid2.pos = [20, 20]
      mid2.size = [200, 200]
      graph.add(mid2)

      const inner = new LGraphGroup('inner')
      inner.pos = [30, 30]
      inner.size = [100, 100]
      graph.add(inner)

      // Track the visited set to verify each group is only fully processed once
      const visited = new Set<number>()
      outer.recomputeInsideNodes(100, visited)

      // All nested groups should be in the visited set
      expect(visited.has(outer.id)).toBe(true)
      expect(visited.has(mid1.id)).toBe(true)
      expect(visited.has(mid2.id)).toBe(true)
      expect(visited.has(inner.id)).toBe(true)
      expect(visited.size).toBe(4)

      // Verify children relationships are correct
      expect(outer.children.has(mid1)).toBe(true)
      expect(outer.children.has(mid2)).toBe(true)
      expect(outer.children.has(inner)).toBe(true)
      expect(mid1.children.has(mid2)).toBe(true)
      expect(mid1.children.has(inner)).toBe(true)
      expect(mid2.children.has(inner)).toBe(true)
    })

    test('respects maxDepth limit', () => {
      const graph = new LGraph()

      const outer = new LGraphGroup('outer')
      outer.pos = [0, 0]
      outer.size = [300, 300]
      graph.add(outer)

      const inner = new LGraphGroup('inner')
      inner.pos = [10, 10]
      inner.size = [100, 100]
      graph.add(inner)

      // With maxDepth=1, inner group is added as child but not processed
      outer.recomputeInsideNodes(1)

      // outer should have inner as a child
      expect(outer.children.has(inner)).toBe(true)
      // inner should not have computed its own children (it was never processed)
      expect(inner.children.size).toBe(0)
    })
  })

  describe('draw', () => {
    test('uses a light contrasting fillStyle for a dark background', () => {
      const group = new LGraphGroup('Group')
      group.color = '#000000'
      const ctx = createMockContext()

      group.draw(graphCanvas, ctx)

      expect(ctx.fillStyle).toBe('#fff')
    })

    test('uses a dark contrasting fillStyle for a light background', () => {
      const group = new LGraphGroup('Group')
      group.color = '#ffffff'
      const ctx = createMockContext()

      group.draw(graphCanvas, ctx)

      expect(ctx.fillStyle).toBe('#000')
    })

    test('does not recompute the contrast color when the background is unchanged', () => {
      const group = new LGraphGroup('Group')
      group.color = '#000000'
      const ctx = createMockContext()
      vi.mocked(colorUtil.textOnColor).mockClear()

      group.draw(graphCanvas, ctx)
      group.draw(graphCanvas, ctx)

      expect(colorUtil.textOnColor).toHaveBeenCalledTimes(1)
    })

    test('recomputes the contrast color when the background changes', () => {
      const group = new LGraphGroup('Group')
      group.color = '#000000'
      const ctx = createMockContext()
      vi.mocked(colorUtil.textOnColor).mockClear()

      group.draw(graphCanvas, ctx)
      group.color = '#ffffff'
      group.draw(graphCanvas, ctx)

      expect(colorUtil.textOnColor).toHaveBeenCalledTimes(2)
    })
  })
})
