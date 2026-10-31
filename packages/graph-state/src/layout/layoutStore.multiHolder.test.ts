import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, watchEffect } from 'vue'

import { layoutStore } from './layoutStore'
import { LayoutSource } from './types'
import type { NodeLayout } from '@comfyorg/graph-model/layout'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { UUID } from '@comfyorg/graph-model/uuid'
import { createUuidv4 } from '@comfyorg/graph-model/uuid'

describe('layoutStore node layout refs', () => {
  const FIRST_GRAPH = createUuidv4()
  const SECOND_GRAPH = createUuidv4()
  const NODE = toNodeId('shared-node')

  function layoutAt(nodeId: NodeId, x: number): NodeLayout {
    return {
      id: nodeId,
      position: { x, y: 100 },
      size: { width: 200, height: 100 },
      zIndex: 0,
      visible: true,
      bounds: { x, y: 100, width: 200, height: 100 }
    }
  }

  function createNode(graphId: UUID, x: number): void {
    layoutStore.applyOperation({
      type: 'createNode',
      graphId,
      nodeId: NODE,
      layout: layoutAt(NODE, x),
      timestamp: 1,
      source: LayoutSource.Canvas,
      actor: 'test'
    })
  }

  function moveNode(graphId: UUID, x: number): void {
    layoutStore.applyOperation({
      type: 'moveNode',
      graphId,
      nodeId: NODE,
      position: { x, y: 100 },
      timestamp: 2,
      source: LayoutSource.Canvas,
      actor: 'test'
    })
  }

  function deleteNode(graphId: UUID): void {
    layoutStore.applyOperation({
      type: 'deleteNode',
      graphId,
      nodeId: NODE,
      timestamp: 3,
      source: LayoutSource.Canvas,
      actor: 'test'
    })
  }

  function observe(graphId: UUID) {
    const seen: (number | undefined)[] = []
    const scope = effectScope()
    scope.run(() => {
      const layout = layoutStore.getNodeLayoutRef(graphId, NODE)
      watchEffect(() => seen.push(layout.value?.position.x), { flush: 'sync' })
    })
    return { seen, stop: () => scope.stop() }
  }

  beforeEach(() => {
    layoutStore.resetForTests()
  })

  it('keeps independent consumers reactive after one stops', () => {
    createNode(FIRST_GRAPH, 100)
    const first = observe(FIRST_GRAPH)
    const second = observe(FIRST_GRAPH)

    first.stop()
    moveNode(FIRST_GRAPH, 500)
    second.stop()

    expect(first.seen).toEqual([100])
    expect(second.seen).toEqual([100, 500])
  })

  it('notifies an existing consumer when a node is deleted and recreated', () => {
    createNode(FIRST_GRAPH, 100)
    const consumer = observe(FIRST_GRAPH)

    deleteNode(FIRST_GRAPH)
    createNode(FIRST_GRAPH, 700)
    consumer.stop()

    expect(consumer.seen).toEqual([100, undefined, 700])
  })

  it('invalidates equal node ids independently across graphs', () => {
    createNode(FIRST_GRAPH, 100)
    createNode(SECOND_GRAPH, 200)
    const first = observe(FIRST_GRAPH)
    const second = observe(SECOND_GRAPH)

    moveNode(FIRST_GRAPH, 300)
    first.stop()
    second.stop()

    expect(first.seen).toEqual([100, 300])
    expect(second.seen).toEqual([200])
  })
})
