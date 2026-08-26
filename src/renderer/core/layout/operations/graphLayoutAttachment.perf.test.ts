import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { effect, stop } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'

type GeometryCounts = {
  contentLookups: number
  rectReads: number
}

describe('render geometry synchronization complexity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
  })

  test.for([245, 500, 1_000])(
    'counts stable-layout synchronization over %i nodes',
    (nodeCount) => {
      const nodes = createNodes(nodeCount)
      const visible = nodes.filter((_, index) => index % 2 === 0)

      // These accesses mirror the geometry boundary crossed by a normal front
      // pass: translation reads pos twice and drawNode reads renderingSize twice.
      expect(countGeometryCalls(() => readFrontPass(visible))).toEqual({
        contentLookups: visible.length * 4,
        rectReads: 0
      })

      // Background connection geometry reads each node position. Layout-hidden
      // nodes remain in render order today, so the denominator is all nodes.
      expect(countGeometryCalls(() => readBackPass(nodes))).toEqual({
        contentLookups: nodeCount * 2,
        rectReads: 0
      })
    }
  )

  test('refreshes exactly once after a real geometry revision', () => {
    const nodes = createNodes(245)
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

    expect(counts).toEqual({ contentLookups: 5, rectReads: 1 })
  })

  test('keeps stable mutation views fresh and extension-compatible', () => {
    const [node] = createNodes(1)
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
    const [node] = createNodes(1)
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

function createNodes(count: number): LGraphNode[] {
  const graph = new LGraph()
  const nodes = Array.from({ length: count }, (_, index) => {
    const node = new LGraphNode(`node-${index}`)
    node.pos = [index * 5, index * 3]
    node.size = [200, 80]
    graph.add(node)
    return node
  })

  // Synchronize every projection before counters start. This isolates the
  // stable-layout draw cost from graph construction and first-read hydration.
  for (const node of nodes) void node.renderingSize[0]
  return nodes
}

function readFrontPass(nodes: readonly LGraphNode[]): void {
  for (const node of nodes) {
    void node.pos[0]
    void node.pos[1]
    void node.renderingSize[0]
    void node.renderingSize[1]
  }
}

function readBackPass(nodes: readonly LGraphNode[]): void {
  for (const node of nodes) {
    void node.pos[0]
    void node.pos[1]
  }
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
