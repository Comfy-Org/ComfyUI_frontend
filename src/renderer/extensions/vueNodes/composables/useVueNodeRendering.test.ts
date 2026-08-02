import { effectScope, ref } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  GraphNodeManager,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import type {
  VueNodeRenderArea,
  VueNodeRenderingSnapshot
} from '@/types/vueNodeRendering'

import { useVueNodeRendering } from './useVueNodeRendering'

const raf = vi.hoisted(() => ({
  callback: undefined as (() => void) | undefined
}))
const renderingService = vi.hoisted(() => ({
  listener: undefined as
    | ((value: VueNodeRenderingSnapshot) => void)
    | undefined,
  nodeMounted: vi.fn(),
  nodeUnmounted: vi.fn(),
  updateRuntime: vi.fn(),
  updateViewport: vi.fn(),
  unsubscribe: vi.fn()
}))
const nodeOptions = vi.hoisted(() => ({ open: false }))
const layoutState = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    isDraggingVueNodes: ref(false),
    isResizingVueNodes: ref(false),
    version: ref(0)
  }
})
const renderArea = Object.freeze([
  0, 0, 100, 100
] as const satisfies VueNodeRenderArea)

const snapshot: VueNodeRenderingSnapshot = Object.freeze({
  graphRevision: 0,
  managerAvailable: true,
  nodeIds: Object.freeze(['1']),
  renderAreas: Object.freeze([
    Object.freeze({
      id: '1',
      area: renderArea
    })
  ]),
  visibleCanvasArea: renderArea,
  renderedNodeIds: Object.freeze(['1']),
  suppressedNodeIds: Object.freeze([]),
  mountedNodeIds: Object.freeze([]),
  initializedNodeIds: Object.freeze([]),
  frontendRequiredNodeIds: Object.freeze([]),
  renderFrozen: false,
  contributionOwners: Object.freeze([])
})

vi.mock('@vueuse/core', () => ({
  useRafFn: (callback: () => void) => {
    raf.callback = callback
    return { pause: vi.fn() }
  }
}))

vi.mock('@/composables/graph/useMoreOptionsMenu', () => ({
  isNodeOptionsOpen: () => nodeOptions.open
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ selectedNodeIds: new Set() }),
  useTitleEditorStore: () => ({ titleEditorTarget: null })
}))

vi.mock('@/renderer/core/canvas/links/slotLinkDragUIState', () => ({
  useSlotLinkDragUIState: () => ({
    state: { active: false, source: null, candidate: null }
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    isDraggingVueNodes: layoutState.isDraggingVueNodes,
    isResizingVueNodes: layoutState.isResizingVueNodes,
    getVersion: () => layoutState.version
  }
}))

vi.mock(
  '@/renderer/extensions/vueNodes/services/vueNodeRenderingService',
  () => ({
    vueNodeRenderingService: {
      getSnapshot: () => snapshot,
      subscribe: (listener: (value: VueNodeRenderingSnapshot) => void) => {
        renderingService.listener = listener
        listener(snapshot)
        return renderingService.unsubscribe
      },
      updateRuntime: renderingService.updateRuntime,
      updateViewport: renderingService.updateViewport,
      nodeMounted: renderingService.nodeMounted,
      nodeUnmounted: renderingService.nodeUnmounted
    }
  })
)

function createCanvas(): LGraphCanvas {
  return {
    graph: {},
    ds: {
      scale: 1,
      offset: [0, 0],
      visible_area: new Float32Array([0, 0, 100, 100]),
      computeVisibleArea: vi.fn()
    },
    viewport: null,
    canvas: { width: 100, height: 100 },
    dirty_canvas: false,
    dirty_bgcanvas: false,
    dragging_canvas: false,
    isDragging: false,
    resizingGroup: null,
    node_capturing_input: null,
    node_widget: null,
    resizing_node: null,
    linkConnector: { renderLinks: [] }
  } as unknown as LGraphCanvas
}

function createNodeManager(): GraphNodeManager {
  return {
    getNode: vi.fn(() => ({ renderArea })),
    vueNodeData: new Map(),
    cleanup: vi.fn()
  } as unknown as GraphNodeManager
}

function createNode(id: string): VueNodeData {
  return {
    executing: false,
    id: toNodeId(id),
    mode: 0,
    selected: false,
    title: `Test ${id}`,
    type: 'Test'
  }
}

describe('useVueNodeRendering', () => {
  let scope: EffectScope | undefined

  beforeEach(() => {
    document.body.innerHTML = '<div data-node-id="1"><input /></div>'
    document.querySelector('input')?.focus()
    renderingService.updateRuntime.mockClear()
    renderingService.updateViewport.mockClear()
    renderingService.unsubscribe.mockClear()
    renderingService.nodeMounted.mockClear()
    renderingService.nodeUnmounted.mockClear()
    layoutState.isDraggingVueNodes.value = false
    layoutState.isResizingVueNodes.value = false
    nodeOptions.open = false
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  it('fast-paths viewport frames without checking focused DOM state', () => {
    const canvas = createCanvas()
    const node = createNode('1')
    scope = effectScope()
    scope.run(() => {
      useVueNodeRendering({
        allNodes: [node],
        canvas,
        nodeManager: createNodeManager()
      })
    })
    renderingService.updateRuntime.mockClear()
    const closestSpy = vi.spyOn(HTMLElement.prototype, 'closest')

    raf.callback?.()

    expect(renderingService.updateRuntime).not.toHaveBeenCalled()
    expect(closestSpy).not.toHaveBeenCalled()

    canvas.dirty_canvas = true
    canvas.ds.scale = 2
    raf.callback?.()

    expect(renderingService.updateRuntime).not.toHaveBeenCalled()
    expect(renderingService.updateViewport).toHaveBeenCalledOnce()
    expect(closestSpy).not.toHaveBeenCalled()
  })

  it('freezes rendering for the full canvas pan interaction', () => {
    const canvas = createCanvas()
    scope = effectScope()
    scope.run(() => {
      useVueNodeRendering({
        allNodes: [createNode('1')],
        canvas,
        nodeManager: createNodeManager()
      })
    })
    renderingService.updateRuntime.mockClear()

    canvas.dragging_canvas = true
    raf.callback?.()

    expect(renderingService.updateRuntime).toHaveBeenLastCalledWith(
      expect.objectContaining({ renderFrozen: true })
    )

    renderingService.updateRuntime.mockClear()
    canvas.ds.offset[0] = 10
    raf.callback?.()

    expect(renderingService.updateRuntime).not.toHaveBeenCalled()
    expect(renderingService.updateViewport).toHaveBeenCalledOnce()

    canvas.dirty_canvas = false
    canvas.dragging_canvas = false
    raf.callback?.()

    expect(renderingService.updateRuntime).toHaveBeenLastCalledWith(
      expect.objectContaining({ renderFrozen: false })
    )
  })

  it('filters rendered nodes, forwards lifecycle, and disposes runtime state', () => {
    scope = effectScope()
    const rendering = scope.run(() =>
      useVueNodeRendering({
        allNodes: [createNode('1'), createNode('2')],
        canvas: createCanvas(),
        nodeManager: createNodeManager()
      })
    )
    if (!rendering) throw new Error('Rendering scope did not start')

    expect(rendering.renderedNodes.value.map((node) => node.id)).toEqual(['1'])

    rendering.onNodeMounted(toNodeId('1'))
    rendering.onNodeUnmounted(toNodeId('2'))
    expect(renderingService.nodeMounted).toHaveBeenCalledWith('1')
    expect(renderingService.nodeUnmounted).toHaveBeenCalledWith('2')

    scope.stop()
    scope = undefined

    expect(renderingService.unsubscribe).toHaveBeenCalledOnce()
    expect(renderingService.updateRuntime).toHaveBeenLastCalledWith({
      graph: null,
      managerAvailable: false,
      nodes: [],
      visibleCanvasArea: null,
      frontendRequiredNodeIds: [],
      renderFrozen: false
    })
  })

  it('preserves the rendered node list while membership is unchanged', () => {
    scope = effectScope()
    const rendering = scope.run(() =>
      useVueNodeRendering({
        allNodes: [createNode('1'), createNode('2')],
        canvas: createCanvas(),
        nodeManager: createNodeManager()
      })
    )
    if (!rendering) throw new Error('Rendering scope did not start')
    const initialNodes = rendering.renderedNodes.value

    renderingService.listener?.(
      Object.freeze({
        ...snapshot,
        visibleCanvasArea: Object.freeze([
          10, 0, 100, 100
        ] as const satisfies VueNodeRenderArea),
        renderedNodeIds: Object.freeze(['1'])
      })
    )

    expect(rendering.renderedNodes.value).toBe(initialNodes)

    renderingService.listener?.(
      Object.freeze({
        ...snapshot,
        renderedNodeIds: Object.freeze(['1', '2'])
      })
    )

    expect(rendering.renderedNodes.value).not.toBe(initialNodes)
    expect(rendering.renderedNodes.value.map((node) => node.id)).toEqual([
      '1',
      '2'
    ])
  })

  it('skips runtime updates while disabled', () => {
    const enabled = ref(false)
    const canvas = createCanvas()
    canvas.dirty_canvas = true
    scope = effectScope()
    scope.run(() => {
      useVueNodeRendering({
        allNodes: [createNode('1')],
        canvas,
        enabled,
        nodeManager: createNodeManager()
      })
    })

    raf.callback?.()
    expect(renderingService.updateRuntime).not.toHaveBeenCalled()

    enabled.value = true
    expect(renderingService.updateRuntime).toHaveBeenCalledOnce()
  })

  it('preserves render areas while rendering is frozen', () => {
    const manager = createNodeManager()
    scope = effectScope()
    scope.run(() => {
      useVueNodeRendering({
        allNodes: [createNode('1')],
        canvas: createCanvas(),
        nodeManager: manager
      })
    })

    layoutState.isDraggingVueNodes.value = true

    expect(renderingService.updateRuntime).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodes: [{ id: '1', renderArea }],
        renderFrozen: true
      })
    )
    expect(manager.getNode).toHaveBeenCalledOnce()
  })
})
