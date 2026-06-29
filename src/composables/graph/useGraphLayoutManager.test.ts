import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGraphLayoutManager } from '@/composables/graph/useGraphLayoutManager'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { app } from '@/scripts/app'

function createPositionedNode() {
  const node = new LGraphNode('test')
  node.pos[0] = 10
  node.pos[1] = 20
  node.size[0] = 120
  node.size[1] = 80
  return node
}

describe('useGraphLayoutManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'app', {
      configurable: true,
      value: app
    })
    vi.spyOn(app, 'configuringGraph', 'get').mockReturnValue(false)
    layoutStore.initializeFromLiteGraph([])
  })

  it('creates layout for added nodes from LiteGraph geometry', () => {
    const graph = new LGraph()
    const node = createPositionedNode()
    useGraphLayoutManager(graph)

    graph.add(node)

    expect(layoutStore.getNodeLayoutRef(node.id).value).toMatchObject({
      id: node.id,
      position: { x: 10, y: 20 },
      size: { width: 120, height: 80 },
      zIndex: 0,
      visible: true
    })
  })

  it('deletes layout for removed nodes', () => {
    const graph = new LGraph()
    const node = createPositionedNode()
    useGraphLayoutManager(graph)

    graph.add(node)
    graph.remove(node)

    expect(layoutStore.getNodeLayoutRef(node.id).value).toBeNull()
  })

  it('waits until graph configuration completes before creating missing layout', () => {
    vi.spyOn(app, 'configuringGraph', 'get').mockReturnValue(true)
    const graph = new LGraph()
    const node = createPositionedNode()
    const originalAfterConfigured = vi.fn()
    node.onAfterGraphConfigured = originalAfterConfigured
    useGraphLayoutManager(graph)

    graph.add(node)

    expect(layoutStore.getNodeLayoutRef(node.id).value).toBeNull()

    node.onAfterGraphConfigured?.()

    expect(originalAfterConfigured).toHaveBeenCalledTimes(1)
    expect(layoutStore.getNodeLayoutRef(node.id).value).toMatchObject({
      id: node.id,
      position: { x: 10, y: 20 },
      size: { width: 120, height: 80 }
    })
  })
})
