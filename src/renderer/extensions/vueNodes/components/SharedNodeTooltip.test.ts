import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'

import SharedNodeTooltip from './SharedNodeTooltip.vue'

const OPEN_DELAY_MS = 100

const Host = defineComponent({
  components: { SharedNodeTooltip, TooltipProvider },
  setup: () => ({ OPEN_DELAY_MS }),
  template: `
    <div>
      <TooltipProvider :delay-duration="OPEN_DELAY_MS">
        <div data-node-tooltip="First tip">first</div>
        <div data-node-tooltip="Second tip" data-node-tooltip-side="left">second</div>
        <div>plain</div>
        <div data-node-tooltip="">empty</div>
        <div data-node-tooltip="" data-node-tooltip-title="Full title">titled</div>
        <SharedNodeTooltip />
      </TooltipProvider>
    </div>
  `
})

function renderHost() {
  render(Host)
  return userEvent.setup()
}

describe('SharedNodeTooltip', () => {
  it('shows the text of the hovered element', async () => {
    const user = renderHost()

    await user.hover(screen.getByText('first'))

    expect(await screen.findByRole('tooltip')).toHaveTextContent('First tip')
    expect(screen.getByText('first')).toHaveAccessibleDescription('First tip')
  })

  it('follows the pointer to another element', async () => {
    const user = renderHost()

    await user.hover(screen.getByText('first'))
    await screen.findByRole('tooltip')
    await user.hover(screen.getByText('second'))

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent('Second tip')
    )
    expect(screen.getByTestId('tooltip-content')).toHaveAttribute(
      'data-side',
      'left'
    )
  })

  it('stays closed over elements without a tooltip', async () => {
    const user = renderHost()

    await user.hover(screen.getByText('first'))
    await screen.findByRole('tooltip')
    await user.hover(screen.getByText('plain'))

    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    )
  })

  it('stays closed over an element with an empty tooltip', async () => {
    const user = renderHost()

    await user.hover(screen.getByText('first'))
    await screen.findByRole('tooltip')
    await user.hover(screen.getByText('empty'))

    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    )
  })

  it('shows the title of an element that has no other text', async () => {
    const user = renderHost()

    await user.hover(screen.getByText('titled'))

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Full title')
  })

  it('shows the new text when the hovered element changes it', async () => {
    const user = renderHost()
    const first = screen.getByText('first')

    await user.hover(first)
    await screen.findByRole('tooltip')
    first.setAttribute('data-node-tooltip', 'Changed tip')

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent('Changed tip')
    )
  })

  it('stays closed when pressed before it opens', async () => {
    const user = renderHost()
    const first = screen.getByText('first')

    await user.hover(first)
    await user.click(first)
    await new Promise((resolve) => setTimeout(resolve, OPEN_DELAY_MS * 3))

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes on press and stays closed until the pointer leaves', async () => {
    const user = renderHost()
    const first = screen.getByText('first')

    await user.hover(first)
    await screen.findByRole('tooltip')
    await user.click(first)
    await user.pointer({ target: first, coords: { x: 5, y: 5 } })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
