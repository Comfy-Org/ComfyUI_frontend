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

const { appMock } = vi.hoisted(() => ({
  appMock: {
    canvas: null as unknown
  }
}))

vi.mock('@/scripts/app', () => ({
  app: appMock
}))

describe('useSubgraphDragBridge', () => {
  const setDirty = vi.fn()
  let originalCanvas: unknown

  beforeEach(() => {
    originalCanvas = appMock.canvas
    vi.useFakeTimers()
    setActivePinia(createPinia())
    layoutStore.clearAllSlotLayouts()
    useSlotLinkDragUIState().endDrag()
    setDirty.mockReset()
  })

  afterEach(() => {
    appMock.canvas = originalCanvas
    layoutStore.clearAllSlotLayouts()
    useSlotLinkDragUIState().endDrag()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('marks a multiline widget backing input as compatible during subgraph-input canvas drag', async () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'prompt', type: 'STRING' }]
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = 501
    targetNode.addInput('prompt', 'STRING')
    targetNode.inputs[0].widget = { name: 'multiline_prompt' }
    subgraph.add(targetNode)

    const slotKey = getSlotKey(String(targetNode.id), 0, true)
    layoutStore.updateSlotLayout(slotKey, {
      nodeId: String(targetNode.id),
      index: 0,
      type: 'input',
      position: { x: 220, y: 140 },
      bounds: { x: 210, y: 130, width: 20, height: 20 }
    })

    const widgetContainer = document.createElement('div')
    widgetContainer.className = 'lg-node-widget'
    widgetContainer.dataset['nodeId'] = String(targetNode.id)

    const hiddenBackingSlot = document.createElement('div')
    hiddenBackingSlot.dataset['slotKey'] = slotKey
    widgetContainer.appendChild(hiddenBackingSlot)
    document.body.appendChild(widgetContainer)

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(widgetContainer)

    const linkConnector = new LinkConnector(() => undefined)

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
    scope.run(() => {
      useSubgraphDragBridge()
    })

    const canvasStore = useCanvasStore()
    canvasStore.canvas = lgCanvas
    await nextTick()

    linkConnector.dragNewFromSubgraphInput(
      subgraph,
      subgraph.inputNode,
      subgraph.inputNode.slots[0]
    )

    const state = useSlotLinkDragUIState().state
    expect(state.active).toBe(true)
    expect(state.compatible.get(slotKey)).toBe(true)

    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 220, clientY: 140 })
    )
    vi.advanceTimersByTime(20)
    await nextTick()

    expect(state.candidate).not.toBeNull()
    expect(state.candidate?.layout.nodeId).toBe(String(targetNode.id))
    expect(state.candidate?.layout.index).toBe(0)
    expect(state.candidate?.compatible).toBe(true)

    scope.stop()
    widgetContainer.remove()
  })
})
