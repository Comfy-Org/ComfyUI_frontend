import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { LayoutChange } from '@/renderer/core/layout/types'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'

import {
  attachNodeLayout,
  detachNodeLayout,
  setNodePosition
} from './graphLayoutAttachment'

describe('node layout attachment ownership', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
  })

  function nodeFor(graph: LGraph, id: string): LGraphNode {
    const node = new LGraphNode(id)
    node.id = toNodeId(id)
    node.graph = graph
    return node
  }

  it('keeps an adopted layout when the stale instance detaches', () => {
    const graph = new LGraph()
    const oldNode = nodeFor(graph, 'shared')
    const replacement = nodeFor(graph, 'shared')
    attachNodeLayout(graph, oldNode)

    attachNodeLayout(graph, replacement)
    detachNodeLayout(oldNode)
    setNodePosition(replacement, [40, 50])

    expect(
      layoutStore.getNodeLayout(graph.id, replacement.id)?.position
    ).toEqual({ x: 40, y: 50 })
  })

  it('supports detach before attaching the replacement', () => {
    const graph = new LGraph()
    const oldNode = nodeFor(graph, 'shared')
    const replacement = nodeFor(graph, 'shared')
    attachNodeLayout(graph, oldNode)

    detachNodeLayout(oldNode)
    attachNodeLayout(graph, replacement)
    setNodePosition(replacement, [60, 70])

    expect(
      layoutStore.getNodeLayout(graph.id, replacement.id)?.position
    ).toEqual({ x: 60, y: 70 })
  })
})

describe('remote source attribution', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
  })

  function nodeFor(graph: LGraph, id: string): LGraphNode {
    const node = new LGraphNode(id)
    node.id = toNodeId(id)
    node.graph = graph
    return node
  }

  /** onChange dispatch is queued via queueMicrotask; hop twice to drain. */
  async function flushChanges(): Promise<void> {
    await new Promise<void>((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    )
  }

  function collectChanges(): { changes: LayoutChange[]; stop: () => void } {
    const changes: LayoutChange[] = []
    const stop = layoutStore.onChange((change) => changes.push(change))
    return { changes, stop }
  }

  it('attach emits a canvas-sourced createNode by default', async () => {
    const graph = new LGraph()
    const node = nodeFor(graph, 'local')
    const { changes, stop } = collectChanges()

    attachNodeLayout(graph, node)
    await flushChanges()
    stop()

    const createOps = changes.filter((c) => c.operation.type === 'createNode')
    expect(createOps).toHaveLength(1)
    expect(createOps[0].source).toBe(LayoutSource.Canvas)
  })

  it('adopts a pre-created remote layout without emitting a second create', async () => {
    const graph = new LGraph()
    const node = nodeFor(graph, 'remote-created')
    const position = { x: 120, y: 340 }
    const size = { width: 200, height: 100 }
    layoutStore.applyOperation({
      graphId: graph.id,
      layout: {
        bounds: { ...position, ...size },
        id: node.id,
        position,
        size,
        zIndex: layoutStore.allocateZIndex(),
        visible: true
      },
      nodeId: node.id,
      source: LayoutSource.Remote,
      timestamp: Date.now(),
      type: 'createNode'
    })
    const { changes, stop } = collectChanges()

    attachNodeLayout(graph, node)
    await flushChanges()
    stop()

    expect(changes).toHaveLength(0)
    expect(layoutStore.getNodeLayout(graph.id, node.id)?.position).toEqual(
      position
    )
    // Adoption syncs litegraph geometry from the store, not the reverse.
    expect(node._pos[0]).toBe(position.x)
    expect(node._pos[1]).toBe(position.y)
  })

  it('detach carries the caller-provided remote source', async () => {
    const graph = new LGraph()
    const node = nodeFor(graph, 'remote-deleted')
    attachNodeLayout(graph, node)
    const { changes, stop } = collectChanges()

    detachNodeLayout(node, { source: LayoutSource.Remote })
    await flushChanges()
    stop()

    const deleteOps = changes.filter((c) => c.operation.type === 'deleteNode')
    expect(deleteOps).toHaveLength(1)
    expect(deleteOps[0].source).toBe(LayoutSource.Remote)
    // A later canvas-driven detach (e.g. LGraph.remove) is a silent no-op.
    detachNodeLayout(node)
    await flushChanges()
    expect(
      changes.filter((c) => c.operation.type === 'deleteNode')
    ).toHaveLength(1)
  })

  it('detach without options keeps the canvas default', async () => {
    const graph = new LGraph()
    const node = nodeFor(graph, 'canvas-deleted')
    attachNodeLayout(graph, node)
    const { changes, stop } = collectChanges()

    detachNodeLayout(node)
    await flushChanges()
    stop()

    const deleteOps = changes.filter((c) => c.operation.type === 'deleteNode')
    expect(deleteOps).toHaveLength(1)
    expect(deleteOps[0].source).toBe(LayoutSource.Canvas)
  })
})
