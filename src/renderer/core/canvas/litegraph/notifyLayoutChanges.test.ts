import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { notifyLayoutChanges } from '@/renderer/core/canvas/litegraph/notifyLayoutChanges'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

function setup() {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  graph.add(node)

  const setDirty = vi.fn()
  const canvas = { graph, setDirty } as unknown as LGraphCanvas
  const stop = notifyLayoutChanges(canvas)
  return { graph, node, setDirty, stop }
}

describe('notifyLayoutChanges', () => {
  it('fires onResize for a resize the store originates', async () => {
    const { graph, node, stop } = setup()
    const onResize = vi.fn()
    node.onResize = onResize

    useLayoutMutations().resizeNode(graph.rootGraph.id, node.id, { width: 300, height: 200 })
    await vi.waitFor(() => expect(onResize).toHaveBeenCalled())
    stop()
  })

  it('leaves onResize alone for a move', async () => {
    const { graph, node, setDirty, stop } = setup()
    const setDirtyCalled = () => setDirty.mock.calls.length > 0
    const onResize = vi.fn()
    node.onResize = onResize

    useLayoutMutations().moveNode(graph.rootGraph.id, node.id, { x: 50, y: 60 })
    await vi.waitFor(() => expect(setDirtyCalled()).toBe(true))

    expect(onResize).not.toHaveBeenCalled()
    stop()
  })

  it('stops notifying once stopped', async () => {
    const { graph, node, setDirty, stop } = setup()
    stop()
    setDirty.mockClear()

    useLayoutMutations().moveNode(graph.rootGraph.id, node.id, { x: 10, y: 10 })
    await Promise.resolve()

    expect(setDirty).not.toHaveBeenCalled()
  })
})
