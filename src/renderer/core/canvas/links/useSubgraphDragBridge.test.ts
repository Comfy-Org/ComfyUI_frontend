import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphDragBridge } from '@/renderer/core/canvas/links/useSubgraphDragBridge'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

const TARGET_NODE_ID = 501
const SLOT_POSITION_X = 220
const SLOT_POSITION_Y = 140
const SLOT_BOUNDS_SIZE = 20

const { appMock } = vi.hoisted(() => ({
  appMock: {
    canvas: null as unknown
  }
}))

vi.mock('@/scripts/app', () => ({
  app: appMock
}))

describe('useSubgraphDragBridge', () => {
  let originalCanvas: unknown
  let scopeCleanup: (() => void) | undefined
  let domCleanup: (() => void) | undefined

  beforeEach(() => {
    originalCanvas = appMock.canvas
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    scopeCleanup?.()
    domCleanup?.()
    scopeCleanup = undefined
    domCleanup = undefined

    appMock.canvas = originalCanvas
    layoutStore.clearAllSlotLayouts()
    useSlotLinkDragUIState().endDrag()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('bridges subgraph-input drag into slot drag state', async () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'prompt', type: 'STRING' }]
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = TARGET_NODE_ID
    targetNode.addInput('prompt', 'STRING')
    targetNode.inputs[0].widget = { name: 'multiline_prompt' }
    subgraph.add(targetNode)

    const slotKey = getSlotKey(String(targetNode.id), 0, true)
    layoutStore.updateSlotLayout(slotKey, {
      nodeId: String(targetNode.id),
      index: 0,
      type: 'input',
      position: { x: SLOT_POSITION_X, y: SLOT_POSITION_Y },
      bounds: {
        x: SLOT_POSITION_X - 10,
        y: SLOT_POSITION_Y - 10,
        width: SLOT_BOUNDS_SIZE,
        height: SLOT_BOUNDS_SIZE
      }
    })

    const widgetContainer = document.createElement('div')
    widgetContainer.className = 'lg-node-widget'
    widgetContainer.dataset['nodeId'] = String(targetNode.id)

    const hiddenBackingSlot = document.createElement('div')
    hiddenBackingSlot.dataset['slotKey'] = slotKey
    widgetContainer.appendChild(hiddenBackingSlot)
    document.body.appendChild(widgetContainer)
    domCleanup = () => widgetContainer.remove()

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(widgetContainer)

    const linkConnector = new LinkConnector(() => undefined)
    const setDirty = vi.fn()

    // appMock.canvas is the global canvas bridge target; lgCanvas is the
    // reactive canvas store value watched by useSubgraphDragBridge.
    const lgCanvas = {
      linkConnector,
      getCanvasWindow: () => window
    } as unknown as LGraphCanvas

    appMock.canvas = {
      graph: subgraph,
      linkConnector,
      setDirty
    }

    const scope = effectScope()
    scopeCleanup = () => scope.stop()
    scope.run(() => {
      useSubgraphDragBridge()
    })

    const canvasStore = useCanvasStore()
    canvasStore.canvas = lgCanvas
    await nextTick()

    const state = useSlotLinkDragUIState().state
    expect(state.active).toBe(false)
    expect(state.source).toBeNull()
    expect(state.compatible.has(slotKey)).toBe(false)

    linkConnector.dragNewFromSubgraphInput(
      subgraph,
      subgraph.inputNode,
      subgraph.inputNode.slots[0]
    )

    expect(state.active).toBe(true)
    expect(state.pointerId).toBe(-1)
    expect(state.source?.nodeId).toBe(String(subgraph.inputNode.id))
    expect(state.source?.slotIndex).toBe(0)
    expect(state.source?.type).toBe('output')
    expect(state.compatible.get(slotKey)).toBe(true)

    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: SLOT_POSITION_X,
        clientY: SLOT_POSITION_Y
      })
    )
    vi.advanceTimersByTime(20)
    await nextTick()

    expect(state.candidate).not.toBeNull()
    expect(state.candidate?.layout.nodeId).toBe(String(targetNode.id))
    expect(state.candidate?.layout.index).toBe(0)
    expect(state.candidate?.compatible).toBe(true)
    expect(setDirty).toHaveBeenCalled()
  })

  it('marks mismatched input type as incompatible for bridge drag', async () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'prompt', type: 'STRING' }]
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = TARGET_NODE_ID
    targetNode.addInput('steps', 'INT')
    subgraph.add(targetNode)

    const slotKey = getSlotKey(String(targetNode.id), 0, true)
    layoutStore.updateSlotLayout(slotKey, {
      nodeId: String(targetNode.id),
      index: 0,
      type: 'input',
      position: { x: SLOT_POSITION_X, y: SLOT_POSITION_Y },
      bounds: {
        x: SLOT_POSITION_X - 10,
        y: SLOT_POSITION_Y - 10,
        width: SLOT_BOUNDS_SIZE,
        height: SLOT_BOUNDS_SIZE
      }
    })

    const linkConnector = new LinkConnector(() => undefined)
    const lgCanvas = {
      linkConnector,
      getCanvasWindow: () => window
    } as unknown as LGraphCanvas

    appMock.canvas = {
      graph: subgraph,
      linkConnector,
      setDirty: vi.fn()
    }

    const scope = effectScope()
    scopeCleanup = () => scope.stop()
    scope.run(() => {
      useSubgraphDragBridge()
    })

    const canvasStore = useCanvasStore()
    canvasStore.canvas = lgCanvas
    await nextTick()

    const state = useSlotLinkDragUIState().state
    expect(state.compatible.has(slotKey)).toBe(false)

    linkConnector.dragNewFromSubgraphInput(
      subgraph,
      subgraph.inputNode,
      subgraph.inputNode.slots[0]
    )

    expect(state.active).toBe(true)
    expect(state.source?.nodeId).toBe(String(subgraph.inputNode.id))
    expect(state.compatible.get(slotKey)).toBe(false)
  })

  it('bridges subgraph-output drag into output compatibility', async () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = TARGET_NODE_ID
    targetNode.addOutput('image', 'IMAGE')
    subgraph.add(targetNode)

    const slotKey = getSlotKey(String(targetNode.id), 0, false)
    layoutStore.updateSlotLayout(slotKey, {
      nodeId: String(targetNode.id),
      index: 0,
      type: 'output',
      position: { x: SLOT_POSITION_X, y: SLOT_POSITION_Y },
      bounds: {
        x: SLOT_POSITION_X - 10,
        y: SLOT_POSITION_Y - 10,
        width: SLOT_BOUNDS_SIZE,
        height: SLOT_BOUNDS_SIZE
      }
    })

    const linkConnector = new LinkConnector(() => undefined)
    const lgCanvas = {
      linkConnector,
      getCanvasWindow: () => window
    } as unknown as LGraphCanvas

    appMock.canvas = {
      graph: subgraph,
      linkConnector,
      setDirty: vi.fn()
    }

    const scope = effectScope()
    scopeCleanup = () => scope.stop()
    scope.run(() => {
      useSubgraphDragBridge()
    })

    const canvasStore = useCanvasStore()
    canvasStore.canvas = lgCanvas
    await nextTick()

    const state = useSlotLinkDragUIState().state
    expect(state.active).toBe(false)

    linkConnector.dragNewFromSubgraphOutput(
      subgraph,
      subgraph.outputNode,
      subgraph.outputNode.slots[0]
    )

    expect(state.active).toBe(true)
    expect(state.pointerId).toBe(-1)
    expect(state.source?.nodeId).toBe(String(subgraph.outputNode.id))
    expect(state.source?.slotIndex).toBe(0)
    expect(state.source?.type).toBe('input')
    expect(state.compatible.get(slotKey)).toBe(true)
  })
})
