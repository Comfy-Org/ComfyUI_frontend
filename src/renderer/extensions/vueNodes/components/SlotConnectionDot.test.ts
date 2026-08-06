import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

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
  it('gives each instance unique svg clip path ids within one app', () => {
    const hollow = { ...defaultSlot, shape: RenderShape.HollowCircle }
    const TwoDots = defineComponent(() => {
      return () =>
        h('div', [
          h(SlotConnectionDot, { slotData: hollow }),
          h(SlotConnectionDot, { slotData: hollow })
        ])
    })
    const { container } = render(TwoDots)

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const clipPaths = [...container.querySelectorAll('clipPath')]
    const ids = clipPaths.map((el) => el.id)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(ids.length)

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const clipped = [...container.querySelectorAll('[clip-path]')]
    expect(clipped).toHaveLength(2)
    for (const el of clipped) {
      const id = el.getAttribute('clip-path')?.match(/url\(#(.+)\)/)?.[1]
      expect(id).toBeTruthy()
      expect(ids).toContain(id)
    }
  })
})
