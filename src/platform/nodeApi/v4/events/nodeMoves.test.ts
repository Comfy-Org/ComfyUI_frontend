import { describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { NodeMoveEvent } from '@/platform/nodeApi/v4/types'

import { apiOnTestCanvas } from './__tests__/testCanvasSource'

function documentOnScreen() {
  const root = new LGraph()
  const outer = new LGraphNode('Outer')
  root.add(outer)
  const subgraph = createTestSubgraph({ rootGraph: root })
  root.subgraphs.set(subgraph.id, subgraph)
  root.add(createTestSubgraphNode(subgraph, { parentGraph: root }))
  const inner = new LGraphNode('Inner')
  subgraph.add(inner)
  return { root, outer, subgraph, inner, ...apiOnTestCanvas(root) }
}

describe('onNodeMoved', () => {
  it('reports a move with the node and its new position, frozen', () => {
    const { root, outer, comfy, move } = documentOnScreen()
    const events: NodeMoveEvent[] = []
    comfy.onNodeMoved((event) => events.push(event))

    move(root.id, [{ nodeId: outer.id, x: 40, y: 50 }])

    expect(events).toEqual([
      { node: comfy.graph.node(String(outer.id)), position: { x: 40, y: 50 } }
    ])
    expect(Object.isFrozen(events[0])).toBe(true)
    expect(Object.isFrozen(events[0].position)).toBe(true)
  })

  it('names a node in a subgraph in its own graph, on screen or not', () => {
    const { root, subgraph, inner, comfy, move, show } = documentOnScreen()
    const graphs: string[] = []
    comfy.onNodeMoved(({ node }) => graphs.push(node.graphId))

    move(root.id, [{ nodeId: inner.id, x: 1, y: 2 }])
    show(subgraph)
    move(root.id, [{ nodeId: inner.id, x: 3, y: 4 }])

    expect(graphs).toEqual([subgraph.id, subgraph.id])
  })

  it('says nothing about a move in another document, or of a node that is gone', () => {
    const { root, outer, comfy, move } = documentOnScreen()
    const moved = vi.fn()
    comfy.onNodeMoved(moved)

    move(new LGraph().id, [{ nodeId: outer.id, x: 3, y: 4 }])
    move(root.id, [{ nodeId: toNodeId(999), x: 3, y: 4 }])

    expect(moved).not.toHaveBeenCalled()

    move(root.id, [{ nodeId: outer.id, x: 3, y: 4 }])

    expect(moved).toHaveBeenCalledOnce()
  })

  it('still reports the rest of a batch after a node it cannot name', () => {
    const { root, outer, comfy, move } = documentOnScreen()
    const moved = vi.fn()
    comfy.onNodeMoved(moved)

    move(root.id, [
      { nodeId: toNodeId(999), x: 3, y: 4 },
      { nodeId: outer.id, x: 5, y: 6 }
    ])

    expect(moved).toHaveBeenCalledExactlyOnceWith({
      node: comfy.graph.node(String(outer.id)),
      position: { x: 5, y: 6 }
    })
  })

  it('says nothing while there is no graph on screen', () => {
    const { comfy, move } = apiOnTestCanvas(null)
    const moved = vi.fn()
    comfy.onNodeMoved(moved)

    move(new LGraph().id, [{ nodeId: toNodeId(1), x: 0, y: 0 }])

    expect(moved).not.toHaveBeenCalled()
  })

  it('stops following moves when its last listener leaves', () => {
    const { comfy, followerCount } = documentOnScreen()
    const stopFirst = comfy.onNodeMoved(vi.fn())
    const stopSecond = comfy.onNodeMoved(vi.fn())

    expect(followerCount()).toBe(1)

    stopFirst()
    stopFirst()

    expect(followerCount()).toBe(1)

    stopSecond()

    expect(followerCount()).toBe(0)
  })

  it('refuses a listener that is not a function', () => {
    const { comfy } = documentOnScreen()

    expect(() => Reflect.apply(comfy.onNodeMoved, comfy, [null])).toThrow(
      'onNodeMoved needs a function to call, not null.'
    )
  })
})

describe('onNodeDragEnd', () => {
  it('fires each time the renderer says a drag ended', () => {
    const { comfy, endDrag } = documentOnScreen()
    const ended = vi.fn()
    comfy.onNodeDragEnd(ended)

    endDrag()
    endDrag()

    expect(ended).toHaveBeenCalledTimes(2)
  })

  it('stops following drags when its last listener leaves', () => {
    const { comfy, endDrag, followerCount } = documentOnScreen()
    const ended = vi.fn()
    const stop = comfy.onNodeDragEnd(ended)

    stop()
    endDrag()

    expect(ended).not.toHaveBeenCalled()
    expect(followerCount()).toBe(0)
  })
})

describe('before the renderer supplies a canvas', () => {
  it('hears no moves or drags and still returns disposers', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    const stops = [comfy.onNodeMoved(vi.fn()), comfy.onNodeDragEnd(vi.fn())]

    expect(() => stops.forEach((stop) => stop())).not.toThrow()
  })
})
