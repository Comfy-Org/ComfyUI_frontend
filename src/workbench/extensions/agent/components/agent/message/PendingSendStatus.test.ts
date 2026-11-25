import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import PendingSendStatus from './PendingSendStatus.vue'

const t = i18n.global.t

function renderStatus(props: ComponentProps<typeof PendingSendStatus>) {
  return render(PendingSendStatus, {
    props,
    global: {
      plugins: [i18n]
    }
  })
}

describe('PendingSendStatus', () => {
  it('disables Retry until retry_after elapses while keeping Delete enabled, then clears the wait instruction', async () => {
    vi.useFakeTimers()
    try {
      renderStatus({
        pending: { clientMessageId: 'cm-ra', status: 'failed' },
        failure: {
          kind: 'retry_after',
          message: 'Billing status is temporarily unavailable; please retry.',
          retryAfterSeconds: 5,
          retryAtMs: Date.now() + 5000
        }
      })

      expect(screen.getByTestId('pending-send-error')).toHaveTextContent(
        'Billing status is temporarily unavailable; please retry. You can try again in 5s.'
      )
      const retry = screen.getByRole('button', { name: t('g.retry') })
      expect(retry).toBeDisabled()
      expect(screen.getByRole('button', { name: t('g.delete') })).toBeEnabled()

      await vi.advanceTimersByTimeAsync(4999)
      expect(retry).toBeDisabled()
      expect(screen.getByTestId('pending-send-error')).toHaveTextContent(
        'You can try again in 5s.'
      )

      await vi.advanceTimersByTimeAsync(1)
      expect(retry).toBeEnabled()
      expect(screen.getByTestId('pending-send-error')).toHaveTextContent(
        'Billing status is temporarily unavailable; please retry.'
      )
      expect(screen.getByTestId('pending-send-error')).not.toHaveTextContent(
        'You can try again in 5s.'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('disables Retry when retryDisabled is true', () => {
    renderStatus({
      pending: { clientMessageId: 'cm-busy', status: 'failed' },
      failure: { kind: 'network', message: t('agent.sendFailedNetwork') },
      retryDisabled: true
    })

    expect(screen.getByRole('button', { name: t('g.retry') })).toBeDisabled()
    expect(screen.getByRole('button', { name: t('g.delete') })).toBeEnabled()
  })

  it.for(['disowned', 'target_unavailable'] as const)(
    'offers New chat and Delete instead of Retry for %s',
    async (kind) => {
      const { emitted } = renderStatus({
        pending: { clientMessageId: `cm-${kind}`, status: 'failed' },
        failure: { kind, message: t('agent.sendFailedDisownedWorkflow') }
      })

      expect(screen.queryByRole('button', { name: t('g.retry') })).toBeNull()
      await userEvent.click(
        screen.getByRole('button', { name: t('agent.newChat') })
      )
      await userEvent.click(screen.getByRole('button', { name: t('g.delete') }))
      expect(emitted().newChat).toEqual([[]])
      expect(emitted().deletePending).toEqual([[`cm-${kind}`]])
    }
  )

  it('hides Retry when retryable is false while keeping Delete', () => {
    renderStatus({
      pending: { clientMessageId: 'cm-unreadable', status: 'failed' },
      failure: {
        kind: 'request',
        message: 'Message failed to send: Unreadable agent response body',
        retryable: false
      }
    })

    expect(screen.queryByRole('button', { name: t('g.retry') })).toBeNull()
    expect(screen.getByRole('button', { name: t('g.delete') })).toBeEnabled()
  })

  it('renders AgentPaywallCard for paywall failures and hides it once paywallResolved', async () => {
    const view = renderStatus({
      pending: {
        clientMessageId: 'cm-pay',
        status: 'failed',
        paywallResolved: false
      },
      failure: { kind: 'paywall', message: "You're out of credits." },
      paywallPresentation: { kind: 'local' }
    })

    await userEvent.click(
      screen.getByRole('button', { name: t('agent.paywall.addCredits') })
    )
    expect(view.emitted().paywallAction).toEqual([
      ['addCredits', 'refused_send']
    ])

    await view.rerender({
      pending: {
        clientMessageId: 'cm-pay',
        status: 'failed',
        paywallResolved: true
      },
      failure: { kind: 'paywall', message: "You're out of credits." },
      paywallPresentation: { kind: 'local' }
    })

    expect(
      screen.queryByRole('button', { name: t('agent.paywall.addCredits') })
    ).toBeNull()
    expect(screen.getByRole('button', { name: t('g.retry') })).toBeEnabled()
  })
})
