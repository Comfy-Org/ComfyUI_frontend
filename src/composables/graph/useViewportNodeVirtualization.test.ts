import { describe, expect, it } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import {
  createPinnedNodeIds,
  createRenderNodeList,
  getViewportBounds
} from '@/composables/graph/useViewportNodeVirtualization'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

function createCanvas(options?: {
  width?: number
  height?: number
  scale?: number
  offset?: [number, number]
  viewport?: [number, number, number, number]
}): LGraphCanvas {
  const element = document.createElement('canvas')
  element.width = options?.width ?? 1000
  element.height = options?.height ?? 500

  return {
    ds: {
      element,
      scale: options?.scale ?? 2,
      offset: options?.offset ?? [10, 20]
    },
    viewport: options?.viewport
  } as LGraphCanvas
}

function createNode(id: string): VueNodeData {
  return {
    id: toNodeId(id),
    title: id,
    type: 'TestNode',
    mode: 0,
    selected: false,
    executing: false
  }
}

describe('getViewportBounds', () => {
  it('matches the canvas transform with 25 percent overscan', () => {
    expect(getViewportBounds(createCanvas())).toEqual({
      x: -135,
      y: -82.5,
      width: 750,
      height: 375
    })
  })

  it('uses the configured LiteGraph viewport', () => {
    expect(
      getViewportBounds(createCanvas({ viewport: [100, 50, 400, 200] }))
    ).toEqual({
      x: -10,
      y: -20,
      width: 300,
      height: 150
    })
  })

  it('updates for pan, zoom, and canvas resize', () => {
    const initial = getViewportBounds(createCanvas())
    const panned = getViewportBounds(createCanvas({ offset: [20, 30] }))
    const zoomed = getViewportBounds(createCanvas({ scale: 1 }))
    const resized = getViewportBounds(createCanvas({ width: 1200 }))

    expect(panned?.x).toBe(initial!.x - 10)
    expect(panned?.y).toBe(initial!.y - 10)
    expect(zoomed?.width).toBe(initial!.width * 2)
    expect(resized?.width).toBe(initial!.width * 1.2)
  })
})

describe('createRenderNodeList', () => {
  const nodes = ['a', 'b', 'c', 'd'].map(createNode)

  it('preserves graph order while combining visible and pinned nodes', () => {
    const result = createRenderNodeList({
      allNodes: nodes,
      enabled: true,
      layoutReady: true,
      visibleNodeIds: new Set([nodes[2].id, nodes[0].id]),
      pinnedNodeIds: new Set([nodes[3].id]),
      previous: []
    })

    expect(result.map((node) => node.id)).toEqual([
      nodes[0].id,
      nodes[2].id,
      nodes[3].id
    ])
  })

  it('retains the render array when its node IDs are unchanged', () => {
    const previous = [nodes[0], nodes[2]]
    const refreshedNodes = nodes.map((node) => ({ ...node }))
    const result = createRenderNodeList({
      allNodes: refreshedNodes,
      enabled: true,
      layoutReady: true,
      visibleNodeIds: new Set([nodes[0].id, nodes[2].id]),
      pinnedNodeIds: new Set(),
      previous
    })

    expect(result).toBe(previous)
    expect(result[0]).toBe(refreshedNodes[0])
    expect(result[1]).toBe(refreshedNodes[2])
  })

  it.for([
    { enabled: false, layoutReady: true },
    { enabled: true, layoutReady: false }
  ])('renders every node for fallback state %o', (state) => {
    const result = createRenderNodeList({
      allNodes: nodes,
      ...state,
      visibleNodeIds: new Set(),
      pinnedNodeIds: new Set(),
      previous: []
    })

    expect(result).toEqual(nodes)
  })
})

describe('createPinnedNodeIds', () => {
  const ids = Array.from({ length: 9 }, (_, index) =>
    toNodeId(String(index + 1))
  )

  it('includes every active-node pinning source', () => {
    const result = createPinnedNodeIds({
      activePointerNodeIds: [ids[0]],
      selectedNodeIds: [ids[1], ids[2]],
      focusedNodeId: ids[3],
      titleEditedNodeId: ids[4],
      contextMenuTargetNodeIds: [ids[5]],
      capturingInputNodeId: ids[6],
      linkEndpointNodeIds: [ids[7], ids[8]]
    })

    expect(result).toEqual(new Set(ids))
  })
})
