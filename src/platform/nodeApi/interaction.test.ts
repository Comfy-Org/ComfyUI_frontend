import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from './comfyApi'
import { ComfyApiError } from './errors'
import {
  createNodeDragEndObserver,
  createNodeMoveObserver,
  provideNodeDragEndSource,
  provideNodeMoveSource,
  resetNodeMoveSource
} from './interaction'
import type {
  NodeDragEndSource,
  NodeMoveSource,
  NodeMoveTarget
} from './interaction'

function movingNode() {
  const graph = new LGraph()
  const node = new LGraphNode('Mover')
  graph.add(node)
  const comfy = createComfyApi(() => graph)
  const target = { rootGraphId: graph.id, nodeId: String(node.id) }
  const handleFor = ({ rootGraphId, nodeId }: NodeMoveTarget) =>
    rootGraphId === graph.id ? comfy.graph.node(nodeId) : undefined
  return { graph, node, comfy, target, handleFor }
}

describe('observing node movement', () => {
  beforeEach(() => resetNodeMoveSource())

  it('refuses rather than silently ignoring when no host wired it', () => {
    const onNodeMoved = createNodeMoveObserver(() => undefined)
    expect(() => onNodeMoved(() => {})).toThrow(ComfyApiError)
  })

  it('delivers a move to the listener as a handle and a position', () => {
    const { target, handleFor } = movingNode()
    let emit: Parameters<NodeMoveSource>[0] | undefined
    provideNodeMoveSource((onMove) => {
      emit = onMove
      return () => (emit = undefined)
    })

    const seen: { id: string; graphId: string; x: number }[] = []
    createNodeMoveObserver(handleFor)((event) => {
      const { graphId } = event.node
      assert.isDefined(graphId)
      seen.push({ id: event.node.id, graphId, x: event.position.x })
    })
    emit?.(target, { x: 120, y: 240 })

    expect(seen).toEqual([
      { id: target.nodeId, graphId: target.rootGraphId, x: 120 }
    ])
  })

  it('drops a move for a node that has since gone', () => {
    const { graph, node, target, handleFor } = movingNode()
    let emit: Parameters<NodeMoveSource>[0] | undefined
    provideNodeMoveSource((onMove) => {
      emit = onMove
      return () => {}
    })

    const seen: unknown[] = []
    createNodeMoveObserver(handleFor)((event) => seen.push(event))
    graph.remove(node)
    emit?.(target, { x: 1, y: 2 })

    expect(seen).toEqual([])
  })

  it('unsubscribes through the host', () => {
    let live = false
    provideNodeMoveSource(() => {
      live = true
      return () => (live = false)
    })

    const stop = createNodeMoveObserver(() => undefined)(() => {})
    expect(live).toBe(true)
    stop()
    expect(live).toBe(false)
  })
})

describe('observing completed node drags', () => {
  beforeEach(() => resetNodeMoveSource())

  it('rejects subscriptions before the host provides a source', () => {
    expect(() => createNodeDragEndObserver(() => undefined)(() => {})).toThrow(
      ComfyApiError
    )
  })

  it('filters missing and deleted nodes', () => {
    const { graph, comfy, target, handleFor } = movingNode()
    const removed = new LGraphNode('Removed')
    graph.add(removed)
    const deleted = comfy.graph.node(String(removed.id))
    assert.exists(deleted)
    graph.remove(removed)

    let emit: Parameters<NodeDragEndSource>[0] | undefined
    provideNodeDragEndSource((listener) => {
      emit = listener
      return () => {
        emit = undefined
      }
    })
    const listener = vi.fn()
    createNodeDragEndObserver((candidate) =>
      candidate.nodeId === deleted.id ? deleted : handleFor(candidate)
    )(listener)

    emit?.([
      target,
      { rootGraphId: graph.id, nodeId: deleted.id },
      { rootGraphId: graph.id, nodeId: 'missing' }
    ])

    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({ id: target.nodeId })
    ])
  })

  it('suppresses delivery when no live nodes remain', () => {
    let emit: Parameters<NodeDragEndSource>[0] | undefined
    provideNodeDragEndSource((listener) => {
      emit = listener
      return () => undefined
    })
    const listener = vi.fn()
    createNodeDragEndObserver(() => undefined)(listener)

    emit?.([{ rootGraphId: 'missing', nodeId: 'missing' }])

    expect(listener).not.toHaveBeenCalled()
  })
})
