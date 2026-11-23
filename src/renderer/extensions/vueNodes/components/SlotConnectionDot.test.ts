import { describe, expect, it } from 'vitest'

import { render, screen } from '@testing-library/vue'

import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { RenderShape } from '@comfyorg/graph-model/globalEnums'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { slotId } from '@comfyorg/graph-model/slotId'

import SlotConnectionDot from './SlotConnectionDot.vue'

const defaultSlot: INodeSlot = {
  name: 'output',
  type: 'IMAGE',
  boundingRect: [0, 0, 0, 0]
}

function renderDot(slotData?: INodeSlot, connected = false) {
  return render(SlotConnectionDot, {
    props: { slotData, connected }
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

  it('draws a right-pointing triangle in the slot color for ARROW, as the canvas does', () => {
    renderDot(
      { ...defaultSlot, shape: RenderShape.ARROW, color_on: '#f00' },
      true
    )

    const arrow = screen.getByTestId('slot-arrow')
    expect(arrow).toHaveAttribute('points', '0,0 100,50 0,100')
    expect(arrow).toHaveAttribute('fill', '#f00')
  })

  it('keeps the type color when the slot sets no color for its state', () => {
    renderDot({ ...defaultSlot, color_on: '#f00' })

    expect(screen.getByTestId('slot-dot')).toHaveAttribute(
      'style',
      expect.stringContaining('--color-datatype-IMAGE')
    )
  })

  it('keeps one slice per type for a multi-type dot, as the canvas does', () => {
    renderDot({ ...defaultSlot, type: 'IMAGE,MASK', color_on: '#f00' }, true)

    expect(screen.getByTestId('slot-dot').tagName).toBe('svg')
  })
})
