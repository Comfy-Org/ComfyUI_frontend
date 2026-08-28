import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import AgentPaywallCard from './AgentPaywallCard.vue'

describe('AgentPaywallCard visual contract', () => {
  it('makes Add credits primary for a subscribed owner', async () => {
    const user = userEvent.setup()
    const onPaywallAction = vi.fn()
    render(AgentPaywallCard, {
      attrs: {
        'aria-label': 'Out of credits card',
        onPaywallAction
      },
      global: { plugins: [i18n] }
    })

    const card = screen.getByLabelText('Out of credits card')
    expect(card).toHaveClass('w-full')
    expect(card).not.toHaveClass('max-w-[372px]')
    expect(screen.getByText('Out of credits')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This workspace has spent its monthly credits and its top-up balance. Add credits to keep the agent running.'
      )
    ).toBeInTheDocument()

    const [upgrade, addCredits] = screen.getAllByRole('button')
    expect(upgrade).toHaveAccessibleName('Upgrade plan')
    expect(upgrade).toHaveClass(
      'text-secondary-foreground',
      'bg-secondary-background'
    )
    expect(addCredits).toHaveAccessibleName('Add credits')
    expect(addCredits).toHaveClass('bg-base-foreground', 'text-base-background')

    await user.click(upgrade!)
    await user.click(addCredits!)
    expect(onPaywallAction.mock.calls).toEqual([['upgrade'], ['addCredits']])
  })
})
