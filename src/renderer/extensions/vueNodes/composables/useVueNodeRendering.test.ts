import { effectScope } from 'vue'
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
  updateRuntime: vi.fn(),
  unsubscribe: vi.fn()
}))
const nodeOptions = vi.hoisted(() => ({ open: false }))
const layoutState = vi.hoisted(() => ({
  isDraggingVueNodes: { __v_isRef: true, value: false },
  isResizingVueNodes: { __v_isRef: true, value: false },
  version: { __v_isRef: true, value: 0 }
}))
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
        listener(snapshot)
        return renderingService.unsubscribe
      },
      updateRuntime: renderingService.updateRuntime,
      nodeMounted: vi.fn(),
      nodeUnmounted: vi.fn()
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
    getNode: () => ({ renderArea }),
    vueNodeData: new Map(),
    cleanup: vi.fn()
  } as unknown as GraphNodeManager
}

describe('useVueNodeRendering', () => {
  let scope: EffectScope

  beforeEach(() => {
    document.body.innerHTML = '<div data-node-id="1"><input /></div>'
    document.querySelector('input')?.focus()
    renderingService.updateRuntime.mockClear()
    renderingService.unsubscribe.mockClear()
    layoutState.isDraggingVueNodes.value = false
    layoutState.isResizingVueNodes.value = false
    nodeOptions.open = false
  })

  afterEach(() => {
    scope.stop()
  })

  it('skips idle frame work and checks numeric state before focused DOM state', () => {
    const canvas = createCanvas()
    const node: VueNodeData = {
      executing: false,
      id: toNodeId('1'),
      mode: 0,
      selected: false,
      title: 'Test',
      type: 'Test'
    }
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

    expect(renderingService.updateRuntime).toHaveBeenCalledOnce()
    expect(closestSpy).toHaveBeenCalledOnce()
  })
})
