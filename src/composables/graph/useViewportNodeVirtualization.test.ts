import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef, watchEffect } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import {
  createPinnedNodeIds,
  createRenderNodeList,
  getViewportBounds,
  useViewportNodeVirtualization
} from '@/composables/graph/useViewportNodeVirtualization'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toNodeId } from '@/types/nodeId'

afterEach(() => {
  vi.restoreAllMocks()
})

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

  const canvas = {
    ds: {
      element,
      scale: options?.scale ?? 2,
      offset: options?.offset ?? [10, 20]
    },
    viewport: options?.viewport
  } as LGraphCanvas
  Object.defineProperty(canvas, 'linkConnector', {
    value: { renderLinks: [] }
  })
  return canvas
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

describe('useViewportNodeVirtualization', () => {
  it('avoids canvas and layout bookkeeping while disabled', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const canvas = vi.fn(() => createCanvas())
    const getLayoutRevision = vi.spyOn(layoutStore, 'getRevision')
    const scope = effectScope()

    scope.run(() => {
      const { renderNodes, refresh } = useViewportNodeVirtualization({
        allNodes: [createNode('a')],
        canvas,
        enabled: false
      })

      refresh(true)

      expect(renderNodes.value.map((node) => node.id)).toEqual([toNodeId('a')])
    })

    expect(canvas).not.toHaveBeenCalled()
    expect(getLayoutRevision).not.toHaveBeenCalled()
    scope.stop()
  })

  it('publishes refreshed node data without replacing a stable render list', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const allNodes = shallowRef([createNode('a')])
    const observedTitles: string[] = []
    const scope = effectScope()

    scope.run(() => {
      const { renderNodes, refresh } = useViewportNodeVirtualization({
        allNodes,
        canvas: null,
        enabled: false
      })
      watchEffect(() => {
        observedTitles.push(renderNodes.value[0]?.title ?? '')
      })

      refresh(true)
      const initialRenderNodes = renderNodes.value
      allNodes.value = [{ ...allNodes.value[0], title: 'updated' }]
      refresh(true)

      expect(renderNodes.value).toBe(initialRenderNodes)
      expect(renderNodes.value[0]?.title).toBe('updated')
    })

    await nextTick()

    expect(observedTitles.at(-1)).toBe('updated')
    scope.stop()
  })

  it('rechecks layout readiness when the node IDs change', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const firstNode = createNode('a')
    const secondNode = createNode('b')
    const allNodes = shallowRef([firstNode])
    vi.spyOn(layoutStore, 'getRevision').mockReturnValue(1)
    vi.spyOn(layoutStore, 'hasNodeLayout').mockImplementation(
      (nodeId) => nodeId === firstNode.id
    )
    vi.spyOn(layoutStore, 'queryNodesInBounds').mockReturnValue([firstNode.id])
    const scope = effectScope()
    const virtualization = scope.run(() =>
      useViewportNodeVirtualization({
        allNodes,
        canvas: createCanvas(),
        enabled: true
      })
    )
    if (!virtualization) {
      scope.stop()
      throw new Error('Expected virtualization scope to initialize')
    }

    try {
      virtualization.refresh(true)
      allNodes.value = [secondNode]
      virtualization.refresh(true)
    } finally {
      scope.stop()
    }

    expect(virtualization.renderNodes.value).toEqual(allNodes.value)
  })

  it('keeps an offscreen input-capturing node pinned', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const offscreenNode = createNode('offscreen')
    const canvas = createCanvas()
    canvas.node_capturing_input = { id: offscreenNode.id } as LGraphNode
    vi.spyOn(layoutStore, 'getRevision').mockReturnValue(1)
    vi.spyOn(layoutStore, 'hasNodeLayout').mockReturnValue(true)
    vi.spyOn(layoutStore, 'queryNodesInBounds').mockReturnValue([])
    const scope = effectScope()
    const virtualization = scope.run(() =>
      useViewportNodeVirtualization({
        allNodes: [offscreenNode],
        canvas,
        enabled: true
      })
    )
    if (!virtualization) {
      scope.stop()
      throw new Error('Expected virtualization scope to initialize')
    }

    try {
      virtualization.refresh(true)
      expect(virtualization.renderNodes.value).toEqual([offscreenNode])

      canvas.node_capturing_input = null
      virtualization.refresh(true)
      expect(virtualization.renderNodes.value).toEqual([])
    } finally {
      scope.stop()
    }
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
