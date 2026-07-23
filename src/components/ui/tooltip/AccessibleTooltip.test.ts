import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import AccessibleTooltip from './AccessibleTooltip.vue'

const openDialogs: HTMLElement[] = []
afterEach(() => {
  for (const dialog of openDialogs.splice(0)) ZIndex.clear(dialog)
})

function openDialogAbove(baseZIndex: number): number {
  const dialog = document.createElement('div')
  ZIndex.set('modal', dialog, baseZIndex)
  openDialogs.push(dialog)
  return Number(dialog.style.zIndex)
}

function renderInCard(
  label: string | string[] = ['Kling', 'Luma'],
  slotText = '+2'
) {
  const cardClick = vi.fn()
  const user = userEvent.setup()

  const Card = {
    components: { AccessibleTooltip },
    template: `
      <div @click="cardClick">
        <AccessibleTooltip :label="label">
          <span>{{ slotText }}</span>
        </AccessibleTooltip>
      </div>
    `,
    setup() {
      return { label: ref(label), slotText, cardClick }
    }
  }

  const { unmount } = render(Card, {
    container: document.body.appendChild(document.createElement('div'))
  })

  return { user, unmount, cardClick }
}

describe('AccessibleTooltip', () => {
  it('reveals the label on hover', async () => {
    const { user, unmount } = renderInCard()
    expect(screen.queryByText('Kling, Luma')).not.toBeInTheDocument()

    await user.hover(screen.getByRole('button'))
    const tooltip = await screen.findByTestId('disclosure-tooltip')
    expect(tooltip).toHaveTextContent('Kling, Luma')

    unmount()
  })

  it('reveals the label on keyboard focus', async () => {
    const { unmount } = renderInCard()
    expect(screen.queryByTestId('disclosure-tooltip')).not.toBeInTheDocument()

    screen.getByRole('button').focus()
    const tooltip = await screen.findByTestId('disclosure-tooltip')
    expect(tooltip).toHaveTextContent('Kling, Luma')

    unmount()
  })

  it('reveals the label on tap/click', async () => {
    const { user, unmount } = renderInCard()
    expect(screen.queryByTestId('disclosure-tooltip')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button'))
    const tooltip = await screen.findByTestId('disclosure-tooltip')
    expect(tooltip).toHaveTextContent('Kling, Luma')

    unmount()
  })

  it('lifts above a dialog that raised the shared modal z-index', async () => {
    const dialogZIndex = openDialogAbove(2400)
    const { user, unmount } = renderInCard()

    await user.hover(screen.getByRole('button'))
    const tooltip = await screen.findByTestId('disclosure-tooltip')

    expect(
      Number(tooltip.style.zIndex),
      'disclosure must out-stack the open dialog, or it renders invisibly behind the modal'
    ).toBeGreaterThan(dialogZIndex)

    unmount()
  })

  it('does not bubble the trigger click to an ancestor card', async () => {
    const { user, cardClick, unmount } = renderInCard()

    await user.click(screen.getByRole('button'))

    expect(cardClick).not.toHaveBeenCalled()
    unmount()
  })

  it('does not announce the label as both name and description on focus', async () => {
    const { unmount } = renderInCard()

    const trigger = screen.getByRole('button')
    trigger.focus()
    await screen.findByTestId('disclosure-tooltip')

    // The value is the button's accessible name; reka's tooltip description
    // must not repeat it, or a screen reader announces it twice.
    expect(trigger).toHaveAccessibleName('Kling, Luma')
    expect(trigger).not.toHaveAccessibleDescription('Kling, Luma')

    unmount()
  })

  it('dismisses the tapped disclosure when Escape is pressed', async () => {
    const { user, unmount } = renderInCard()

    await user.click(screen.getByRole('button'))
    await screen.findByTestId('disclosure-tooltip')

    await user.keyboard('{Escape}')
    await vi.waitFor(() => {
      expect(screen.queryByTestId('disclosure-tooltip')).not.toBeInTheDocument()
    })

    unmount()
  })

  it('exposes the joined label as the accessible name', () => {
    const { unmount } = renderInCard(['Google', 'OpenAI'])
    expect(
      screen.getByRole('button', { name: 'Google, OpenAI' })
    ).toBeInTheDocument()
    unmount()
  })

  it('uses a plain string label directly', () => {
    const { unmount } = renderInCard('Google')
    expect(screen.getByRole('button', { name: 'Google' })).toBeInTheDocument()
    unmount()
  })
})
