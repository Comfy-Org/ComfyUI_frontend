import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import AgentPaywallCard from './AgentPaywallCard.vue'

describe('AgentPaywallCard visual contract', () => {
  // Visual hierarchy is the Storybook surface's contract; this asserts the copy,
  // the offered actions, and what each emits.
  it('offers Upgrade plan and Add credits to a subscribed owner and emits each action', async () => {
    const user = userEvent.setup()
    const onPaywallAction = vi.fn()
    render(AgentPaywallCard, {
      props: { presentation: { kind: 'subscribed', showUpgrade: true } },
      attrs: {
        'aria-label': 'Out of credits card',
        onPaywallAction
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByLabelText('Out of credits card')).toBeInTheDocument()
    expect(screen.getByText('Out of credits')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This workspace has spent its monthly credits and its top-up balance. Add credits to keep the agent running.'
      )
    ).toBeInTheDocument()

    const upgrade = screen.getByRole('button', { name: 'Upgrade plan' })
    const addCredits = screen.getByRole('button', { name: 'Add credits' })

    await user.click(upgrade)
    await user.click(addCredits)
    expect(onPaywallAction.mock.calls).toEqual([['upgrade'], ['addCredits']])
  })

  it('announces the server denial without purchase actions when capabilities are unknown', () => {
    render(AgentPaywallCard, {
      props: { message: 'Your workspace spend limit was reached.' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your workspace spend limit was reached.'
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.for([
    {
      presentation: { kind: 'member' as const },
      body: 'This workspace has used all its credits. Ask your workspace owner to add more.'
    },
    {
      presentation: { kind: 'salesManaged' as const },
      body: 'This workspace is billed through your Comfy account team. Contact them to add credits.'
    }
  ])(
    'renders $presentation.kind remediation without a dead-end action',
    ({ presentation, body }) => {
      render(AgentPaywallCard, {
        props: { presentation },
        global: { plugins: [i18n] }
      })

      expect(screen.getByText(body)).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    }
  )

  it.for([
    {
      presentation: { kind: 'subscriptionRequired' as const },
      body: "You've run out of available credits.",
      action: 'Subscribe',
      emitted: 'subscribe'
    },
    {
      presentation: { kind: 'local' as const },
      body: "You've spent your credit balance. Add credits to keep the agent running.",
      action: 'Add credits',
      emitted: 'addCredits'
    },
    {
      presentation: { kind: 'subscribed' as const, showUpgrade: false },
      body: 'This workspace has spent its monthly credits and its top-up balance. Add credits to keep the agent running.',
      action: 'Add credits',
      emitted: 'addCredits'
    }
  ])(
    'renders $presentation.kind with a single $action action',
    async ({ presentation, body, action, emitted }) => {
      const user = userEvent.setup()
      const onPaywallAction = vi.fn()
      render(AgentPaywallCard, {
        props: { presentation },
        attrs: { onPaywallAction },
        global: { plugins: [i18n] }
      })

      expect(screen.getByText(body)).toBeInTheDocument()
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(1)
      expect(buttons[0]).toHaveAccessibleName(action)
      expect(screen.queryByRole('button', { name: 'Upgrade plan' })).toBeNull()

      await user.click(buttons[0])
      expect(onPaywallAction.mock.calls).toEqual([[emitted]])
    }
  )
})
