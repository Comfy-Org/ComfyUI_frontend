import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createMockCanvasPointerEvent } from '@/utils/__tests__/litegraphTestUtils'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphDragBridge } from '@/renderer/core/canvas/links/useSubgraphDragBridge'
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

describe('useSubgraphDragBridge drop race', () => {
  const setDirty = vi.fn()
  let originalCanvas: unknown

  beforeEach(() => {
    originalCanvas = appMock.canvas
    vi.useFakeTimers()
    setActivePinia(createPinia())
    layoutStore.clearAllSlotLayouts()
    setDirty.mockReset()
  })

  afterEach(() => {
    appMock.canvas = originalCanvas
    layoutStore.clearAllSlotLayouts()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('intercepts canvas drop when pointer enters compatible slot in same frame', async () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'prompt', type: 'STRING' }]
    })

    const targetNode = new LGraphNode('Target')
    targetNode.id = 610
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

    const droppedListener = vi.fn()
    const linkConnector = new LinkConnector(() => undefined)
    linkConnector.events.addEventListener('dropped-on-canvas', droppedListener)

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

    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 220, clientY: 140 })
    )

    linkConnector.dropOnNothing(createMockCanvasPointerEvent(220, 140))

    expect(targetNode.inputs[0].link).not.toBeNull()
    expect(droppedListener).not.toHaveBeenCalled()

    scope.stop()
    widgetContainer.remove()
  })
})
