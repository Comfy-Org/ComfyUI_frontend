import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished } from 'vitest'
import { h } from 'vue'

import { raiseModalLayer, releaseModalLayer } from '@/utils/modalLayerStack'

import HoverCard from './HoverCard.vue'
import HoverCardContent from './HoverCardContent.vue'
import HoverCardTrigger from './HoverCardTrigger.vue'

function openModalLayer() {
  const layer = document.createElement('div')
  raiseModalLayer(layer)
  onTestFinished(() => releaseModalLayer(layer))
  return Number(layer.style.zIndex)
}

async function hoverOpen() {
  const user = userEvent.setup()
  const { emitted } = render(HoverCard, {
    props: { openDelay: 0 },
    slots: {
      default: () => [
        h(HoverCardTrigger, { as: 'button' }, () => 'Open hover card'),
        h(HoverCardContent, null, () => 'Hover card body')
      ]
    }
  })
  await user.hover(screen.getByRole('button', { name: 'Open hover card' }))
  const body = await screen.findByText('Hover card body')
  return { content: body, emitted }
}

describe('HoverCard', () => {
  it('opens on hover and forwards the open state', async () => {
    const { emitted } = await hoverOpen()

    expect(emitted('update:open')).toEqual([[true]])
  })

  it('keeps its static z-index while no modal layer is open', async () => {
    const { content } = await hoverOpen()

    expect(content.style.zIndex).toBe('')
  })

  it('lifts above the top modal layer', async () => {
    const dialogZIndex = openModalLayer()

    const { content } = await hoverOpen()

    expect(Number(content.style.zIndex)).toBe(dialogZIndex + 1)
  })
})
