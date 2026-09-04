import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { isNodeExcludedFromCulling } from '@/services/vueNodeCullingService'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

import { canvasNodeTarget } from './canvasCoachTarget'

const { TITLE_HEIGHT } = vi.hoisted(() => ({ TITLE_HEIGHT: 30 }))

const state = vi.hoisted(() => ({
  camera: null as Record<string, number> | null,
  currentGraph: null as {
    getNodeById: (id: unknown) => unknown
    rootGraph: { id: ReturnType<typeof createUuidv4> }
  } | null,
  collapsed: new Set<string>(),
  layout: null as { value: unknown } | null,
  layoutReads: vi.fn(),
  canvasOffset: { left: 0, top: 0 },
  releaseBounds: vi.fn()
}))

function graph(id: string) {
  return {
    id,
    rootGraph: { id: createUuidv4() },
    getNodeById: (nodeId: unknown) => ({
      collapsed: state.collapsed.has(String(nodeId))
    })
  }
}

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: { NODE_TITLE_HEIGHT: TITLE_HEIGHT }
}))
vi.mock('@/renderer/core/layout/transform/useTransformState', async () => {
  const { reactive } = await import('vue')
  state.camera = reactive({ x: 0, y: 0, z: 1 })
  return { useTransformState: () => ({ camera: state.camera }) }
})
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { canvas: document.createElement('canvas') },
    get currentGraph() {
      return state.currentGraph
    }
  })
}))
vi.mock('@/renderer/core/layout/store/layoutStore', async () => {
  const { shallowRef } = await import('vue')
  state.layout = shallowRef<unknown>(null)
  return {
    layoutStore: {
      getNodeLayoutRef: (graphId: unknown, nodeId: unknown) => {
        state.layoutReads(graphId, nodeId)
        return state.layout
      }
    }
  }
})
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const { computed, onScopeDispose } = await import('vue')
  return {
    ...actual,
    useElementBounding: () => {
      onScopeDispose(state.releaseBounds)
      return {
        left: computed(() => state.canvasOffset.left),
        top: computed(() => state.canvasOffset.top)
      }
    }
  }
})

function placeNode(bounds = { x: 100, y: 200, width: 80, height: 40 }) {
  state.layout!.value = { bounds }
}

describe('canvasNodeTarget', () => {
  afterEach(() => {
    state.currentGraph = graph('root')
    state.collapsed.clear()
    state.canvasOffset = { left: 0, top: 0 }
    if (state.camera) Object.assign(state.camera, { x: 0, y: 0, z: 1 })
    if (state.layout) state.layout.value = null
    state.layoutReads.mockClear()
    state.releaseBounds.mockClear()
  })

  it('releases what it watches when the tour drops it', () => {
    state.currentGraph = graph('root')
    const nodeId = toNodeId(1)
    const target = canvasNodeTarget(nodeId)
    expect(state.releaseBounds).not.toHaveBeenCalled()
    expect(isNodeExcludedFromCulling(nodeId)).toBe(true)

    target.dispose?.()

    expect(
      state.releaseBounds,
      'nothing here runs from a component, so unreleased observers outlive every tour'
    ).toHaveBeenCalledTimes(1)
    expect(isNodeExcludedFromCulling(nodeId)).toBe(false)
  })

  it('places the rect over the node, title bar included', () => {
    state.currentGraph = graph('root')
    placeNode({ x: 100, y: 200, width: 80, height: 40 })

    expect(
      canvasNodeTarget(toNodeId(6)).getRect(),
      'layout holds the body box, but the node renders its title above it'
    ).toEqual(new DOMRect(100, 200 - TITLE_HEIGHT, 80, 40 + TITLE_HEIGHT))
  })

  it('carries the node through pan and zoom', () => {
    state.currentGraph = graph('root')
    placeNode({ x: 100, y: 200, width: 80, height: 40 })
    Object.assign(state.camera!, { x: 10, y: 20, z: 2 })
    state.canvasOffset = { left: 5, top: 7 }

    expect(
      canvasNodeTarget(toNodeId(6)).getRect(),
      'the ring has to land on the node wherever the camera puts it'
    ).toEqual(
      new DOMRect(
        (100 + 10) * 2 + 5,
        (200 - TITLE_HEIGHT + 20) * 2 + 7,
        80 * 2,
        (40 + TITLE_HEIGHT) * 2
      )
    )
  })

  it('withholds a rect until the node has a layout', () => {
    state.currentGraph = graph('root')
    const rootGraphId = state.currentGraph.rootGraph.id
    const nodeId = toNodeId(6)

    expect(
      canvasNodeTarget(nodeId).getRect(),
      'a step must wait for its target rather than spotlight nothing'
    ).toBeNull()
    expect(state.layoutReads).toHaveBeenCalledWith(rootGraphId, nodeId)
  })

  it('withholds a rect once the graph it resolved against is gone', () => {
    state.currentGraph = graph('root')
    placeNode()
    const target = canvasNodeTarget(toNodeId(6))
    expect(target.getRect()).not.toBeNull()

    state.currentGraph = graph('another-workflow')

    expect(
      target.getRect(),
      'node ids are graph-local, so id 6 elsewhere is a different node'
    ).toBeNull()
  })

  it('withholds a rect for a collapsed node, which renders no widget', () => {
    state.currentGraph = graph('root')
    placeNode()
    state.collapsed.add('6')

    expect(
      canvasNodeTarget(toNodeId(6)).getRect(),
      'a collapsed node hides the widget the card asks the user to use'
    ).toBeNull()
  })

  it('reports the node itself changing, which the camera never announces', async () => {
    const scope = effectScope()
    const notify = vi.fn()
    scope.run(() => canvasNodeTarget(toNodeId(1)).onMove(notify))

    placeNode({ x: 40, y: 60, width: 80, height: 30 })
    await nextTick()

    expect(
      notify,
      'a node moved or resized under a still camera leaves the ring behind'
    ).toHaveBeenCalled()
    scope.stop()
  })

  it('reports a resize, which moves the canvas under a still camera', () => {
    const scope = effectScope()
    const notify = vi.fn()
    scope.run(() => canvasNodeTarget(toNodeId(1)).onMove(notify))

    window.dispatchEvent(new Event('resize'))

    expect(
      notify,
      'the canvas offset changes without the camera moving'
    ).toHaveBeenCalled()
    scope.stop()
  })

  it('reports the camera moving, which fires no scroll or resize event', async () => {
    const scope = effectScope()
    const notify = vi.fn()
    scope.run(() => canvasNodeTarget(toNodeId(1)).onMove(notify))

    state.camera!.x = 250
    await nextTick()

    expect(
      notify,
      'a node the camera carries moves with nothing to announce it'
    ).toHaveBeenCalled()
    scope.stop()
  })

  it('stops reporting once the step that subscribed has gone', async () => {
    const scope = effectScope()
    const notify = vi.fn()
    const stop = scope.run(() => canvasNodeTarget(toNodeId(1)).onMove(notify))!
    stop()

    state.camera!.x = 120
    placeNode({ x: 1, y: 2, width: 3, height: 4 })
    await nextTick()
    window.dispatchEvent(new Event('resize'))

    expect(
      notify,
      'a subscription outliving its step repositions a card that is gone'
    ).not.toHaveBeenCalled()
    scope.stop()
  })
})
