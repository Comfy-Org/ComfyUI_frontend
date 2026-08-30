import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Tooltip from './Tooltip.vue'

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
