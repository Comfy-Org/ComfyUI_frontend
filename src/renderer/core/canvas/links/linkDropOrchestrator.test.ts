import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotLayout } from '@/renderer/core/layout/types'
import { createSlotLinkDragContext } from '@/renderer/extensions/vueNodes/composables/slotLinkDragContext'
import { toNodeId } from '@/types/nodeId'
import type { SlotId } from '@/types/slotId'

import { resolveSlotTargetCandidate } from './linkDropOrchestrator'

const NODE_ID = toNodeId('node-1')

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
    layoutStore.initializeFromLiteGraph([])
    useSlotLinkDragUIState().clearCompatible()
  })

  it('resolves a DOM slot key through the layout store and caches compatibility', () => {
    const slotKey = getSlotKey(NODE_ID, 1, true)
    const layout = createSlotLayout()
    layoutStore.updateSlotLayout(slotKey, layout)
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
})
