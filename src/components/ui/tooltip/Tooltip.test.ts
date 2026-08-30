import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Tooltip from './Tooltip.vue'

const openDialogs: HTMLElement[] = []

afterEach(() => {
  for (const dialog of openDialogs.splice(0)) ZIndex.clear(dialog)
})

function renderTooltip(
  config: string | { value: string; showDelay?: number } = 'Helpful text',
  side: 'top' | 'right' | 'bottom' | 'left' = 'top'
) {
  return render(Tooltip, {
    props: { config, side },
    slots: { default: '<button>Trigger</button>' }
  })
}

describe('Tooltip', () => {
  it('opens after the configured hover delay', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTooltip({ value: 'Delayed text', showDelay: 300 })

    await user.hover(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(300)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Delayed text')
  })

  it('opens on keyboard focus and describes its trigger', async () => {
    const user = userEvent.setup()
    renderTooltip()

    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
    expect(screen.getByRole('button')).toHaveAccessibleDescription(
      'Helpful text'
    )
  })

  it('opens on click without bubbling or duplicating the accessible label', async () => {
    const cardClick = vi.fn()
    const user = userEvent.setup()
    const Card = {
      components: { Tooltip },
      template: `
        <div @click="cardClick">
          <Tooltip config="Helpful text" open-on-click suppress-description>
            <button aria-label="Helpful text">Trigger</button>
          </Tooltip>
        </div>
      `,
      setup: () => ({ cardClick })
    }
    render(Card)

    const trigger = screen.getByRole('button')
    await user.click(trigger)

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
    expect(cardClick).not.toHaveBeenCalled()
    expect(trigger).toHaveAccessibleName('Helpful text')
    expect(trigger).not.toHaveAccessibleDescription('Helpful text')
  })

  it('dismisses a click-opened tooltip with Escape', async () => {
    const user = userEvent.setup()
    render(Tooltip, {
      props: { config: 'Helpful text', openOnClick: true },
      slots: { default: '<button>Trigger</button>' }
    })

    await user.click(screen.getByRole('button'))
    await screen.findByRole('tooltip')
    await user.keyboard('{Escape}')

    await vi.waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('lifts above the shared modal z-index', async () => {
    const dialog = document.createElement('div')
    ZIndex.set('modal', dialog, 2400)
    openDialogs.push(dialog)
    const user = userEvent.setup()
    renderTooltip()

    await user.hover(screen.getByRole('button'))
    const tooltip = await screen.findByRole('tooltip')

    expect(Number(tooltip.style.zIndex)).toBeGreaterThan(
      Number(dialog.style.zIndex)
    )
  })

  it.for(['top', 'right', 'bottom', 'left'] as const)(
    'places content on the %s side',
    async (side) => {
      const user = userEvent.setup()
      renderTooltip('Helpful text', side)

      await user.hover(screen.getByRole('button'))

      expect(await screen.findByRole('tooltip')).toHaveAttribute(
        'data-side',
        side
      )
    }
  )
})
