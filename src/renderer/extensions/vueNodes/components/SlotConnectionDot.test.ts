import { describe, expect, it } from 'vitest'

import { render, screen } from '@testing-library/vue'

import type { INodeSlot } from '@comfyorg/litegraph/litegraph'
import { RenderShape } from '@comfyorg/graph-model/globalEnums'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { slotId } from '@comfyorg/graph-model/slotId'

import SlotConnectionDot from './SlotConnectionDot.vue'

const defaultSlot: INodeSlot = {
  name: 'output',
  type: 'IMAGE',
  boundingRect: [0, 0, 0, 0]
}

function renderDot(slotData?: INodeSlot) {
  return render(SlotConnectionDot, {
    props: { slotData }
  })
}

describe('SlotConnectionDot', () => {
  it('renders circle shape by default', () => {
    renderDot(defaultSlot)

    const dot = screen.getByTestId('slot-dot')
    expect(dot).toHaveClass('rounded-full')
    expect(dot.tagName).toBe('DIV')
  })

  it('renders rounded square for GRID shape', () => {
    renderDot({
      ...defaultSlot,
      shape: RenderShape.GRID
    })

    const dot = screen.getByTestId('slot-dot')
    expect(dot).toHaveClass('rounded-[1px]')
    expect(dot).not.toHaveClass('rounded-full')
    expect(dot.tagName).toBe('DIV')
  })

  it('identifies the visual dot as the measured slot element', () => {
    const slotKey = slotId(toNodeId('node-with-hyphen'), 'input', 2)
    render(SlotConnectionDot, {
      props: { slotData: defaultSlot, slotKey }
    })

    expect(screen.getByTestId('slot-dot')).toHaveAttribute(
      'data-slot-key',
      slotKey
    )
  })
})
