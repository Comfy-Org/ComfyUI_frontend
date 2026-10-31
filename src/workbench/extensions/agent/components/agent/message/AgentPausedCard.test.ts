import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { PausedPart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import AgentPausedCard from './AgentPausedCard.vue'

function pausedPart(overrides: Partial<PausedPart> = {}): PausedPart {
  return {
    type: 'paused',
    askId: 'turn-1:call-paused',
    prompt: 'Paused until credits are added.',
    message: 'Paused until credits are added.',
    reason: 'no_funds',
    recheckAfterSeconds: 60,
    ...overrides
  }
}

describe('AgentPausedCard', () => {
  it.for([
    {
      presentation: { kind: 'subscribed' as const, showUpgrade: false },
      action: 'Add credits',
      emitted: 'addCredits'
    },
    {
      presentation: { kind: 'local' as const },
      action: 'Add credits',
      emitted: 'addCredits'
    },
    {
      presentation: { kind: 'subscriptionRequired' as const },
      action: 'Subscribe',
      emitted: 'subscribe'
    }
  ])(
    'offers $action to a $presentation.kind viewer out of credits',
    async ({ presentation, action, emitted }) => {
      const user = userEvent.setup()
      const onPaywallAction = vi.fn()
      render(AgentPausedCard, {
        props: { part: pausedPart(), presentation },
        attrs: { onPaywallAction },
        global: { plugins: [i18n] }
      })

      expect(
        screen.getByText('The agent paused — out of credits')
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: action }))
      expect(onPaywallAction.mock.calls).toEqual([[emitted]])
    }
  )

  it.for([
    { kind: 'member' as const },
    { kind: 'salesManaged' as const },
    { kind: 'unavailable' as const }
  ])('leaves a $kind viewer no dead-end purchase action', (presentation) => {
    render(AgentPausedCard, {
      props: { part: pausedPart(), presentation },
      global: { plugins: [i18n] }
    })

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName('Resume')
  })

  it('names a pause it cannot attribute to credits neutrally, with no CTA', () => {
    render(AgentPausedCard, {
      props: {
        part: pausedPart({
          reason: 'workspace_paused',
          message: 'An administrator paused this workspace.'
        }),
        presentation: { kind: 'subscribed', showUpgrade: false }
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('The agent is paused')).toBeInTheDocument()
    expect(
      screen.getByText('An administrator paused this workspace.')
    ).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName('Resume')
  })

  it.for([
    { recheckAfterSeconds: 1, line: 'in about 1 second.' },
    { recheckAfterSeconds: 60, line: 'in about 60 seconds.' }
  ])(
    'agrees with $recheckAfterSeconds in the recheck line',
    ({ recheckAfterSeconds, line }) => {
      render(AgentPausedCard, {
        props: { part: pausedPart({ recheckAfterSeconds }) },
        global: { plugins: [i18n] }
      })

      expect(screen.getByRole('alert')).toHaveTextContent(line)
    }
  )

  it('drops the recheck line when the server names no window', () => {
    render(AgentPausedCard, {
      props: { part: pausedPart({ recheckAfterSeconds: 0 }) },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('alert')).not.toHaveTextContent('try again')
  })

  it('answers the ask with resume', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(AgentPausedCard, {
      props: { part: pausedPart() },
      attrs: { onAnswer },
      global: { plugins: [i18n] }
    })

    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(onAnswer.mock.calls).toEqual([['turn-1:call-paused', 'resume']])
  })
})
