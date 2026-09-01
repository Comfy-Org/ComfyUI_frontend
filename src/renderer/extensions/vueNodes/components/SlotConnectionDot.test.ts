import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import { toNodeId } from '@/types/nodeId'
import { slotId } from '@/types/slotId'

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

  it('exposes an accessible keyboard-activated connection control', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(SlotConnectionDot, {
      props: { slotData: defaultSlot, accessibleName: 'output' },
      attrs: { onClick }
    })

    const control = screen.getByRole('button', { name: 'output' })
    control.focus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledOnce()
  })
})
