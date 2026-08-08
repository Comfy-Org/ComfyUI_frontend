import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Y from 'yjs'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { notifyLayoutChanges } from '@/renderer/core/canvas/litegraph/notifyLayoutChanges'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { getLayoutStoreYDoc } from '@/renderer/core/layout/store/layoutStoreTestUtils'
import { LayoutSource } from '@/renderer/core/layout/types'
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

describe('notifyLayoutChanges', () => {
  it('does not repeat onResize for a canvas resize', async () => {
    using context = setup()
    const { node, setDirty } = context
    const onResize = vi.fn()
    node.onResize = onResize

    node.setSize([300, 200])
    await vi.waitFor(() => expect(setDirty).toHaveBeenCalled())

    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it.for([{ path: 'direct' }, { path: 'batched' }] as const)(
    'fires onResize for an external $path resize',
    async ({ path }) => {
      using context = setup()
      const { graph, node } = context
      const onResize = vi.fn()
      node.onResize = onResize

      if (path === 'direct') {
        const mutations = useLayoutMutations()
        mutations.setSource(LayoutSource.Vue)
        mutations.resizeNode(graph.rootGraph.id, node.id, {
          width: 300,
          height: 200
        })
      } else {
        layoutStore.batchUpdateNodeBounds(graph.rootGraph.id, [
          {
            nodeId: node.id,
            bounds: { x: 0, y: 0, width: 300, height: 200 }
          }
        ])
      }
      await vi.waitFor(() => expect(onResize).toHaveBeenCalled())
    }
  )

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

    layoutStore.batchUpdateNodeBounds(graph.rootGraph.id, [
      {
        nodeId: node.id,
        bounds: {
          x: 50,
          y: 60,
          width: layout.size.width,
          height: layout.size.height
        }
      }
    ])
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

    useLayoutMutations().resizeNode(otherGraph.rootGraph.id, otherNode.id, {
      width: 300,
      height: 200
    })
    await Promise.resolve()

    expect(otherNode.id).toBe(node.id)
    expect(onResize).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('invalidates rendering for a raw Yjs geometry change', () => {
    using context = setup()
    const { graph, node, setDirty } = context
    const doc = getLayoutStoreYDoc()
    setDirty.mockClear()
    doc
      .getMap<Y.Map<unknown>>('nodes')
      .get(`${graph.rootGraph.id}:${node.id}`)
      ?.set('position', { x: 80, y: 90 })

    expect(setDirty).toHaveBeenCalledWith(true, true)
  })

  it('stops notifying once stopped', async () => {
    using context = setup()
    const { graph, node, setDirty } = context
    context.stop()
    setDirty.mockClear()

    useLayoutMutations().moveNode(graph.rootGraph.id, node.id, { x: 10, y: 10 })
    await Promise.resolve()

    expect(setDirty).not.toHaveBeenCalled()
  })
})
