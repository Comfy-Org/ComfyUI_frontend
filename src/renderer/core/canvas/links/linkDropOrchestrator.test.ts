import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotLayout } from '@/renderer/core/layout/types'
import { createSlotLinkDragContext } from '@/renderer/extensions/vueNodes/composables/slotLinkDragContext'
import { toNodeId } from '@/types/nodeId'
import type { SlotId } from '@/types/slotId'

import {
  resolveNodeSurfaceSlotCandidate,
  resolveSlotTargetCandidate
} from './linkDropOrchestrator'

const NODE_ID = toNodeId('node-1')
const getGraphSlotLayout = vi.hoisted(() => vi.fn())

vi.mock('@/renderer/core/canvas/litegraph/slotCalculations', () => ({
  getGraphSlotLayout
}))

function createSlotLayout(): SlotLayout {
  return {
    nodeId: NODE_ID,
    index: 1,
    type: 'input',
    position: { x: 10, y: 20 },
    bounds: { x: 5, y: 15, width: 10, height: 10 }
  }
}

function createDropTarget(slotKey: SlotId): HTMLElement {
  const target = document.createElement('div')
  target.className = 'lg-slot'

  const slot = document.createElement('div')
  slot.dataset.slotKey = String(slotKey)
  target.append(slot)
  document.body.append(target)

  return target
}

function createAdapter() {
  const isInputValidDrop = vi.fn(() => true)
  const isOutputValidDrop = vi.fn(() => false)
  const adapter = fromPartial<LinkConnectorAdapter>({
    renderLinks: [{ fromSlot: { type: 'number' } }],
    linkConnector: { state: { connectingTo: 'input' } },
    isInputValidDrop,
    isOutputValidDrop
  })

  return { adapter, isInputValidDrop, isOutputValidDrop }
}

describe('resolveSlotTargetCandidate', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    getGraphSlotLayout.mockReset()
    layoutStore.resetForTests()
    useSlotLinkDragUIState().clearCompatible()
  })

  it('resolves a DOM slot key and caches compatibility', () => {
    const slotKey = getSlotKey(NODE_ID, 1, true)
    const layout = createSlotLayout()
    getGraphSlotLayout.mockReturnValue(layout)
    const target = createDropTarget(slotKey)
    const { adapter, isInputValidDrop } = createAdapter()
    const context = {
      adapter,
      graph: fromPartial<LGraph>({}),
      session: createSlotLinkDragContext()
    }

    const firstCandidate = resolveSlotTargetCandidate(target, context)
    const secondCandidate = resolveSlotTargetCandidate(target, context)

    expect(firstCandidate).toEqual({ layout, compatible: true })
    expect(secondCandidate).toEqual({ layout, compatible: true })
    expect(isInputValidDrop).toHaveBeenCalledTimes(1)
    expect(isInputValidDrop).toHaveBeenCalledWith(NODE_ID, 1)
  })

  it('does not target an advanced widget input that was not rendered', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.id = NODE_ID
    const widget = node.addWidget('number', 'advanced', 0, null, {
      advanced: true
    })
    const input = node.addInput('advanced', 'number')
    input.widget = { name: widget.name }
    graph.add(node)

    const target = document.createElement('div')
    target.dataset.nodeId = String(NODE_ID)
    const { adapter, isInputValidDrop } = createAdapter()

    const candidate = resolveNodeSurfaceSlotCandidate(target, {
      adapter,
      graph,
      session: createSlotLinkDragContext()
    })

    expect(candidate).toBeNull()
    expect(isInputValidDrop).not.toHaveBeenCalled()
    expect(getGraphSlotLayout).not.toHaveBeenCalled()
  })
})
