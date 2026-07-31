import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, inject } from 'vue'

import HoverCard from './HoverCard.vue'
import HoverCardTrigger from './HoverCardTrigger.vue'
import { hoverCardOpenKey } from './hoverCardContext'

const OpenStateProbe = defineComponent({
  setup() {
    const isOpen = inject(hoverCardOpenKey)

    return () =>
      h('span', { 'data-testid': 'open-state' }, String(isOpen?.value))
  }
})

function renderHoverCard(props: { defaultOpen?: boolean; open?: boolean }) {
  return render(HoverCard, {
    props,
    slots: {
      default: () => h(OpenStateProbe)
    }
  })
}

describe('HoverCard', () => {
  it('provides the default open state to its content', () => {
    renderHoverCard({ defaultOpen: true })

    expect(screen.getByTestId('open-state').textContent).toBe('true')
  })

  it('mirrors controlled open prop updates', async () => {
    const { rerender } = renderHoverCard({ open: false })

    expect(screen.getByTestId('open-state').textContent).toBe('false')

    await rerender({ open: true })
    expect(screen.getByTestId('open-state').textContent).toBe('true')

    await rerender({ open: false })
    expect(screen.getByTestId('open-state').textContent).toBe('false')
  })

  it('mirrors and forwards uncontrolled open updates', async () => {
    const user = userEvent.setup()
    const { emitted } = render(HoverCard, {
      props: { openDelay: 0 },
      slots: {
        default: () => [
          h(HoverCardTrigger, { as: 'button' }, () => 'Open hover card'),
          h(OpenStateProbe)
        ]
      }
    })

    await user.hover(screen.getByRole('button', { name: 'Open hover card' }))

    await waitFor(() => {
      expect(screen.getByTestId('open-state').textContent).toBe('true')
      expect(emitted('update:open')).toEqual([[true]])
    })
  })
})
