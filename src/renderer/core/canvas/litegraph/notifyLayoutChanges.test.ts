import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { notifyLayoutChanges } from '@/renderer/core/canvas/litegraph/notifyLayoutChanges'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toGroupId } from '@/types/groupId'
import { createUuidv4 } from '@/utils/uuid'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

function setup() {
  const graph = new LGraph()
  graph.id = createUuidv4()
  const node = new LGraphNode('test')
  graph.add(node)

  const setDirty = vi.fn()
  const canvas = { graph, setDirty } as unknown as LGraphCanvas
  const stop = notifyLayoutChanges(canvas)
  return {
    graph,
    node,
    setDirty,
    stop,
    [Symbol.dispose]() {
      stop()
      graph.clear()
    }
  }
}

type TestContext = ReturnType<typeof setup>

describe('notifyLayoutChanges', () => {
  it('does not change graph membership order after a z-index change', async () => {
    using context = setup()
    const second = context.graph.add(new LGraphNode('second'))!

    useLayoutMutations(LayoutSource.Vue).setNodeZIndex(
      context.graph.id,
      context.node.id,
      100
    )

    await vi.waitFor(() => expect(context.setDirty).toHaveBeenCalled())
    expect(context.graph._nodes).toEqual([context.node, second])
  })

  it('does not repeat onResize for a canvas resize', async () => {
    using context = setup()
    const { node, setDirty } = context
    const onResize = vi.fn()
    node.onResize = onResize

    node.setSize([300, 200])
    await vi.waitFor(() => expect(setDirty).toHaveBeenCalled())

    expect(onResize).toHaveBeenCalledTimes(1)
    expect([...onResize.mock.calls[0][0]]).toEqual([300, 200])
  })

  it.for([
    {
      path: 'direct',
      resize: ({ graph, node }: TestContext) => {
        layoutStore.applyOperation({
          type: 'resizeNode',
          graphId: graph.rootGraph.id,
          nodeId: node.id,
          size: { width: 300, height: 200 },
          timestamp: Date.now(),
          source: LayoutSource.Vue
        })
      }
    },
    {
      path: 'batched',
      resize: ({ graph, node }: TestContext) => {
        layoutStore.batchUpdateNodeBounds(
          graph.rootGraph.id,
          [
            {
              nodeId: node.id,
              bounds: { x: 0, y: 0, width: 300, height: 200 }
            }
          ],
          { source: LayoutSource.Vue }
        )
      }
    }
  ])('fires onResize for an external $path resize', async ({ resize }) => {
    using context = setup()
    const onResize = vi.fn()
    context.node.onResize = onResize

    resize(context)
    await vi.waitFor(() => expect(onResize).toHaveBeenCalled())
    expect([...onResize.mock.calls[0][0]]).toEqual([300, 200])
  })

  it('leaves onResize alone when a bounds batch only moves', async () => {
    using context = setup()
    const { graph, node, setDirty } = context
    const setDirtyCalled = () => setDirty.mock.calls.length > 0
    const onResize = vi.fn()
    node.onResize = onResize
    const layout = layoutStore.getNodeLayoutRef(
      graph.rootGraph.id,
      node.id
    ).value
    if (!layout) throw new Error('Expected registered node layout')

    layoutStore.batchUpdateNodeBounds(
      graph.rootGraph.id,
      [
        {
          nodeId: node.id,
          bounds: {
            x: 50,
            y: 60,
            width: layout.size.width,
            height: layout.size.height
          }
        }
      ],
      { source: LayoutSource.Vue }
    )
    await vi.waitFor(() => expect(setDirtyCalled()).toBe(true))

    expect(onResize).not.toHaveBeenCalled()
  })

  it('ignores changes from another root graph', async () => {
    const otherGraph = new LGraph()
    otherGraph.id = createUuidv4()
    const otherNode = new LGraphNode('other')
    otherGraph.add(otherNode)
    using context = setup()
    const { node, setDirty } = context
    const onResize = vi.fn()
    node.onResize = onResize

    layoutStore.applyOperation({
      type: 'resizeNode',
      graphId: otherGraph.rootGraph.id,
      nodeId: otherNode.id,
      size: { width: 300, height: 200 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })
    await Promise.resolve()

    expect(otherNode.id).toBe(node.id)
    expect(onResize).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('invalidates rendering for a group-only change', async () => {
    using context = setup()
    const { graph, setDirty } = context
    const groupId = toGroupId(1)
    layoutStore.applyOperation({
      type: 'createGroup',
      graphId: graph.rootGraph.id,
      groupId,
      layout: {
        id: groupId,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      },
      timestamp: Date.now(),
      source: LayoutSource.Vue
    })
    setDirty.mockClear()

    layoutStore.applyOperation({
      type: 'setGroupBounds',
      graphId: graph.rootGraph.id,
      groupId,
      position: { x: 10, y: 10 },
      size: { width: 120, height: 110 },
      timestamp: Date.now(),
      source: LayoutSource.Vue
    })

    await vi.waitFor(() => expect(setDirty).toHaveBeenCalledWith(true, true))
  })

  it('invalidates rendering only when slot offsets change', async () => {
    using context = setup()
    const { graph, node, setDirty } = context
    const offsets = [
      { index: 0, type: 'input' as const, position: { x: 0, y: 10 } }
    ]

    layoutStore.updateNodeSlotOffsets(
      graph.rootGraph.id,
      node.id,
      offsets,
      'expanded'
    )
    await vi.waitFor(() => expect(setDirty).toHaveBeenCalledWith(true, true))
    setDirty.mockClear()

    layoutStore.updateNodeSlotOffsets(
      graph.rootGraph.id,
      node.id,
      offsets,
      'expanded'
    )
    await Promise.resolve()
    expect(setDirty).not.toHaveBeenCalled()

    layoutStore.updateNodeSlotOffsets(
      graph.rootGraph.id,
      node.id,
      [],
      'collapsed'
    )
    await Promise.resolve()
    expect(setDirty).not.toHaveBeenCalled()

    layoutStore.updateNodeSlotOffsets(
      graph.rootGraph.id,
      node.id,
      [{ ...offsets[0], position: { x: 0, y: 20 } }],
      'expanded'
    )
    await vi.waitFor(() => expect(setDirty).toHaveBeenCalledWith(true, true))
  })

  it('stops notifying once stopped', async () => {
    using context = setup()
    const { graph, node, setDirty } = context
    context.stop()
    setDirty.mockClear()

    useLayoutMutations(LayoutSource.Canvas).moveNode(
      graph.rootGraph.id,
      node.id,
      { x: 10, y: 10 }
    )
    await Promise.resolve()

    expect(setDirty).not.toHaveBeenCalled()
  })
})
