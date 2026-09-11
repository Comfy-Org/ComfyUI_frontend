import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import type { LinkConnectorEventMap } from '@/lib/litegraph/src/infrastructure/LinkConnectorEventMap'
import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { toNodeId } from '@/types/nodeId'

import { useSubgraphDragBridge } from './useSubgraphDragBridge'

/**
 * The bridge is the only listener that turns a canvas-drawn subgraph IO drag
 * into Vue slot drag state. GraphCanvas mounts it against the live
 * `LGraphCanvas`, so its collaborators (`linkConnector.events` and
 * `getCanvasWindow()`) are exercised here against a canvas double rather than
 * through a component mount.
 */
const appMock = vi.hoisted(() => ({
  app: { canvas: null as LGraphCanvas | null }
}))

vi.mock('@/scripts/app', () => appMock)

const SOURCE_NODE_ID = toNodeId(1)
const TARGET_NODE_ID = toNodeId(2)

function createTargetGraph() {
  const graph = new LGraph()
  const target = new LGraphNode('Target')
  target.id = TARGET_NODE_ID
  target.addInput('value', 'INT')
  graph.add(target)
  return graph
}

function createCanvasDouble(isInputValidDrop: () => boolean) {
  const events = new CustomEventTarget<LinkConnectorEventMap>()

  const linkConnector = fromPartial<LinkConnector>({
    events,
    state: {},
    renderLinks: [
      {
        node: { id: SOURCE_NODE_ID },
        fromSlotIndex: 3,
        fromDirection: LinkDirection.RIGHT,
        fromPos: [120, 240]
      }
    ],
    isInputValidDrop: vi.fn(isInputValidDrop)
  })

  const canvas = fromPartial<LGraphCanvas>({
    graph: createTargetGraph(),
    linkConnector,
    setDirty: vi.fn(),
    getCanvasWindow: () => window
  })

  return { canvas, linkConnector }
}

function startBridge(canvas: LGraphCanvas) {
  const scope = effectScope()
  scope.run(() => useSubgraphDragBridge())
  useCanvasStore().canvas = canvas
  return scope
}

describe('useSubgraphDragBridge', () => {
  const { state, endDrag } = useSlotLinkDragUIState()

  beforeEach(() => {
    endDrag()
    appMock.app.canvas = null
  })

  it('mirrors a canvas-initiated drag into Vue slot drag state', async () => {
    const { canvas, linkConnector } = createCanvasDouble(() => true)
    appMock.app.canvas = canvas
    const scope = startBridge(canvas)
    await nextTick()

    linkConnector.events.dispatch('connecting', { connectingTo: 'input' })

    expect(state.active).toBe(true)
    expect(state.source).toMatchObject({
      nodeId: SOURCE_NODE_ID,
      slotIndex: 3,
      type: 'output',
      direction: LinkDirection.RIGHT,
      position: { x: 120, y: 240 }
    })

    scope.stop()
  })

  it('records per-slot compatibility for the slots being dragged toward', async () => {
    const { canvas, linkConnector } = createCanvasDouble(() => false)
    appMock.app.canvas = canvas
    const scope = startBridge(canvas)
    await nextTick()

    linkConnector.events.dispatch('connecting', { connectingTo: 'input' })

    expect(state.compatible.get(getSlotKey(TARGET_NODE_ID, 0, true))).toBe(
      false
    )
    expect(linkConnector.isInputValidDrop).toHaveBeenCalled()

    scope.stop()
  })

  it('ends the drag when the connector resets', async () => {
    const { canvas, linkConnector } = createCanvasDouble(() => true)
    appMock.app.canvas = canvas
    const scope = startBridge(canvas)
    await nextTick()

    linkConnector.events.dispatch('connecting', { connectingTo: 'input' })
    linkConnector.events.dispatch('reset', true)

    expect(state.active).toBe(false)

    scope.stop()
  })

  it('ends an in-flight drag and stops listening when its scope is disposed', async () => {
    const { canvas, linkConnector } = createCanvasDouble(() => true)
    appMock.app.canvas = canvas
    const scope = startBridge(canvas)
    await nextTick()

    linkConnector.events.dispatch('connecting', { connectingTo: 'input' })
    scope.stop()

    expect(state.active).toBe(false)

    linkConnector.events.dispatch('connecting', { connectingTo: 'input' })

    expect(state.active).toBe(false)
  })
})
