import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type {
  LayoutOperation,
  ResizeNodeOperation
} from '@/renderer/core/layout/types'

function setup() {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  node.size[0] = 210
  node.size[1] = 100
  graph.add(node)

  // Registers the node in layoutStore with its current size.
  useGraphNodeManager(graph)

  const applySpy = vi.spyOn(layoutStore, 'applyOperation')
  const resizeCommits = (): ResizeNodeOperation[] =>
    applySpy.mock.calls
      .map(([operation]: [LayoutOperation]) => operation)
      .filter(
        (operation): operation is ResizeNodeOperation =>
          operation.type === 'resizeNode' && operation.nodeId === node.id
      )

  return { graph, node, resizeCommits }
}

describe('LGraphNode size reflow', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.initializeFromLiteGraph([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('commits once when a widget-growth idiom mutates size[1] directly', () => {
    const { node, resizeCommits } = setup()
    const layout = layoutStore.getNodeLayoutRef(node.id)
    expect(layout.value?.size.height).toBe(100)

    node.size[1] = 180

    expect(layout.value?.size.height).toBe(180)
    expect(layout.value?.size.width).toBe(210)
    expect(
      resizeCommits(),
      'element mutation bypassing the setter still commits exactly one resize'
    ).toHaveLength(1)
  })

  it('commits per-axis for sequential bare-element writes on both axes', () => {
    const { node, resizeCommits } = setup()

    node.size[0] = 260
    node.size[1] = 140

    const layout = layoutStore.getNodeLayoutRef(node.id)
    expect(layout.value?.size).toEqual({ width: 260, height: 140 })
    expect(
      resizeCommits().map((operation) => operation.size),
      'each bare-element write commits independently, so the width grows before the height'
    ).toEqual([
      { width: 260, height: 100 },
      { width: 260, height: 140 }
    ])
  })

  it('commits once when the whole size array is assigned via the setter', () => {
    const { node, resizeCommits } = setup()

    node.size = [260, 140]

    const layout = layoutStore.getNodeLayoutRef(node.id)
    expect(layout.value?.size).toEqual({ width: 260, height: 140 })
    expect(resizeCommits()).toHaveLength(1)
  })

  it('does not re-commit when the write-back path re-applies the current size (no feedback loop)', () => {
    const { node, resizeCommits } = setup()

    node.size[1] = 300
    expect(resizeCommits()).toHaveLength(1)

    const layout = layoutStore.getNodeLayoutRef(node.id).value
    node.size = [layout!.size.width, layout!.size.height]

    expect(
      resizeCommits(),
      'the layout-sync write-back re-applies the equal size, but the isSizeEqual guard keeps it a no-op'
    ).toHaveLength(1)
  })

  it('commits when an in-place TypedArray method mutates size', () => {
    const { node, resizeCommits } = setup()

    const size = node.size
    if (!(size instanceof Float64Array)) throw new Error('not a Float64Array')
    size.set([260, 160])

    const layout = layoutStore.getNodeLayoutRef(node.id)
    expect(layout.value?.size).toEqual({ width: 260, height: 160 })
    expect(
      resizeCommits(),
      'size.set(...) mutates in place without hitting the set trap, but still commits'
    ).toHaveLength(1)
  })

  it('does not commit for size mutations before the node joins a graph', () => {
    const detached = new LGraphNode('detached')

    expect(() => {
      detached.size[1] = 500
    }).not.toThrow()
    expect(detached.size[1]).toBe(500)
  })

  it('serializes size as a plain array, never leaking the Proxy', () => {
    const { node } = setup()
    node.size[1] = 175

    const serialized = node.serialize()
    expect(Array.isArray(serialized.size)).toBe(true)
    expect(serialized.size).toEqual([210, 175])
    expect(serialized.size instanceof Float64Array).toBe(false)
    expect(() => structuredClone(serialized)).not.toThrow()
  })
})
