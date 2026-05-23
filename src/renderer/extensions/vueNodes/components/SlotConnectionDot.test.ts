import { describe, expect, it } from 'vitest'

import { render, screen } from '@testing-library/vue'

import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'

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
})
