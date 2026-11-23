import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'

import SharedNodeTooltip from './SharedNodeTooltip.vue'

const OPEN_DELAY_MS = 100

function renderHost(delayDuration?: number) {
  const text = ref('First tip')
  const present = ref(true)
  const mounted = ref(true)
  const Host = defineComponent({
    components: { SharedNodeTooltip, TooltipProvider },
    setup: () => ({ OPEN_DELAY_MS, text, present, mounted, delayDuration }),
    template: `
      <div data-testid="container">
        <TooltipProvider :delay-duration="OPEN_DELAY_MS" :skip-delay-duration="0">
          <div v-if="present" :data-node-tooltip="text">first</div>
          <div data-node-tooltip="Second tip" data-node-tooltip-side="left">second</div>
          <div>plain</div>
          <div data-node-tooltip="">empty</div>
          <div data-node-tooltip="" data-node-tooltip-title="">empty title</div>
          <div data-node-tooltip="" data-node-tooltip-title="Full title">titled</div>
          <SharedNodeTooltip v-if="mounted" :delay-duration />
        </TooltipProvider>
      </div>
    `
  })

  render(Host)
  return {
    user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }),
    text,
    present,
    mounted
  }
}

describe('SharedNodeTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  it('waits for the hover delay before showing accessible text', async () => {
    const { user } = renderHost()

    await user.hover(screen.getByText('first'))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS - 1)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)

    expect(screen.getByRole('tooltip')).toHaveTextContent('First tip')
    expect(screen.getByText('first')).toHaveAccessibleDescription('First tip')
  })

  it('uses the surface delay instead of the surrounding provider delay', async () => {
    const { user } = renderHost(35)

    await user.hover(screen.getByText('first'))
    await vi.advanceTimersByTimeAsync(34)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)

    expect(screen.getByRole('tooltip')).toHaveTextContent('First tip')
  })

  it('follows the pointer to another element', async () => {
    const { user } = renderHost()

    await user.hover(screen.getByText('first'))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
    await user.hover(screen.getByText('second'))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(screen.getByRole('tooltip')).toHaveTextContent('Second tip')
    expect(screen.getByText('first')).not.toHaveAttribute('aria-describedby')
    expect(screen.getByTestId('tooltip-content')).toHaveAttribute(
      'data-side',
      'left'
    )
  })

  it.for(['plain', 'empty', 'empty title'])(
    'stays closed over the %s element',
    async (label) => {
      const { user } = renderHost()

      await user.hover(screen.getByText('first'))
      await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
      await user.hover(screen.getByText(label))
      await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      expect(screen.getByText('first')).not.toHaveAttribute('aria-describedby')
    }
  )

  it('shows the title of an element that has no other text', async () => {
    const { user } = renderHost()

    await user.hover(screen.getByText('titled'))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(screen.getByRole('tooltip')).toHaveTextContent('Full title')
  })

  it('shows the new text when the hovered element changes it', async () => {
    const { user, text } = renderHost()

    await user.hover(screen.getByText('first'))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
    text.value = 'Changed tip'
    await nextTick()
    await vi.advanceTimersByTimeAsync(1)

    expect(screen.getByRole('tooltip')).toHaveTextContent('Changed tip')
  })

  it.for([0, OPEN_DELAY_MS])(
    'cancels the tooltip when its target becomes empty after %i ms',
    async (elapsed) => {
      const { user, text } = renderHost()
      const first = screen.getByText('first')

      await user.hover(first)
      await vi.advanceTimersByTimeAsync(elapsed)
      text.value = ''
      await nextTick()
      await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      expect(first).not.toHaveAttribute('aria-describedby')
    }
  )

  it.for([0, OPEN_DELAY_MS])(
    'cancels the tooltip when its target is removed after %i ms',
    async (elapsed) => {
      const { user, present } = renderHost()
      const first = screen.getByText('first')

      await user.hover(first)
      await vi.advanceTimersByTimeAsync(elapsed)
      present.value = false
      await nextTick()
      await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      expect(first).not.toHaveAttribute('aria-describedby')
    }
  )

  it('restores the provider delay when an open tooltip unmounts', async () => {
    const { user, mounted } = renderHost()
    const first = screen.getByText('first')

    await user.hover(first)
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
    mounted.value = false
    await nextTick()
    expect(first).not.toHaveAttribute('aria-describedby')
    await vi.advanceTimersByTimeAsync(1)
    mounted.value = true
    await nextTick()
    await user.hover(screen.getByText('second'))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS - 1)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Second tip')
  })

  it('stays closed when pressed before it opens', async () => {
    const { user } = renderHost()
    const first = screen.getByText('first')

    await user.hover(first)
    await user.pointer({ target: first, keys: '[MouseLeft>]' })
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes on pointerdown and stays closed until the pointer leaves', async () => {
    const { user } = renderHost()
    const first = screen.getByText('first')

    await user.hover(first)
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
    await user.pointer({ target: first, keys: '[MouseLeft>]' })
    await user.pointer({ target: first, coords: { x: 5, y: 5 } })
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(first).not.toHaveAttribute('aria-describedby')
  })

  it.for(['wheel', 'pointerleave'])('closes on container %s', async (event) => {
    const { user } = renderHost()
    const first = screen.getByText('first')

    await user.hover(first)
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)
    screen.getByTestId('container').dispatchEvent(new Event(event))
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(first).not.toHaveAttribute('aria-describedby')
  })

  it.for([
    { name: 'touch', pointerType: 'touch', buttons: 0 },
    { name: 'held mouse', pointerType: 'mouse', buttons: 1 }
  ])('does not open for $name movement', async ({ pointerType, buttons }) => {
    renderHost()

    screen
      .getByText('first')
      .dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, pointerType, buttons })
      )
    await vi.advanceTimersByTimeAsync(OPEN_DELAY_MS)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
