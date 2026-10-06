import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { RetentionOfferOutcome } from '@/platform/cloud/subscription/utils/retentionOffer'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

import RetentionOfferDialogContent from './RetentionOfferDialogContent.vue'

vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'))

type TerminalOperation = Awaited<
  ReturnType<ReturnType<typeof useBillingOperationStore>['startOperation']>
>

function settlesAs(status: TerminalOperation['status']) {
  vi.mocked(useBillingOperationStore().startOperation).mockImplementation(
    async (opId, type): Promise<TerminalOperation> => ({
      opId,
      type,
      status,
      errorMessage: null,
      startedAt: 0,
      operationStartedAt: 0,
      actionUrl: null,
      authenticationState: null,
      isAuthenticating: false,
      canRetryAuthentication: false,
      authenticationRequiredSeen: false,
      blockedOnCustomerSeen: false,
      workspaceId: 'workspace-1',
      autoHandleRequiresAction: false,
      phase: null,
      dismissed: false
    })
  )
}

function renderOffer({
  isScopeCurrent = (): boolean => true
}: { isScopeCurrent?: () => boolean } = {}) {
  const onDecide = vi.fn<(outcome: RetentionOfferOutcome) => void>()
  render(RetentionOfferDialogContent, {
    props: {
      offer: {
        id: 'save_30_next_3_v1',
        percent_off: 30,
        duration_in_months: 3
      },
      subscription: {
        currency: 'usd',
        unit_amount: 2000,
        quantity: 1,
        period_end: Date.UTC(2026, 10, 1, 12) / 1000
      },
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
      isScopeCurrent,
      onDecide
    },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
  return { onDecide, user: userEvent.setup() }
}

describe('RetentionOfferDialogContent', () => {
  it('shows the discounted price and records that the offer was displayed', () => {
    renderOffer()

    expect(screen.getByText('Stay for 30% off')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Keep your plan for $14.00 a month instead of $20.00 for the next 3 months, starting with your renewal on November 1, 2026.'
      )
    ).toBeInTheDocument()
    expect(
      workspaceApi.recordRetentionFlowEvent
    ).toHaveBeenCalledExactlyOnceWith({
      session_id: 'session-1',
      event: 'offer_shown'
    })
  })

  it.for([
    { action: 'Continue to cancel', outcome: 'continueToCancel' },
    { action: 'Close', outcome: 'dismissed' }
  ] as const)(
    '$action before accepting decides $outcome',
    async ({ action, outcome }) => {
      const { onDecide, user } = renderOffer()

      await user.click(screen.getByRole('button', { name: action }))

      expect(onDecide).toHaveBeenCalledExactlyOnceWith(outcome)
      expect(workspaceApi.acceptRetentionOffer).not.toHaveBeenCalled()
    }
  )

  it('keeps the plan once the discount is applied', async () => {
    settlesAs('succeeded')
    const { onDecide, user } = renderOffer()

    await user.click(screen.getByRole('button', { name: 'Keep my plan' }))
    await screen.findByText(
      "Your discount is applied. You'll get 30% off for the next 3 months."
    )
    await user.click(screen.getAllByRole('button', { name: 'Close' })[0])

    expect(onDecide).toHaveBeenCalledExactlyOnceWith('retained')
  })

  it('offers to check again when the outcome is unconfirmed', async () => {
    settlesAs('timeout')
    const { onDecide, user } = renderOffer()

    await user.click(screen.getByRole('button', { name: 'Keep my plan' }))
    await screen.findByRole('button', { name: 'Check again' })
    await user.click(screen.getAllByRole('button', { name: 'Close' })[0])

    expect(onDecide).toHaveBeenCalledExactlyOnceWith('pending')
  })

  it('lets the owner continue to cancel after the offer fails', async () => {
    settlesAs('failed')
    const { onDecide, user } = renderOffer()

    await user.click(screen.getByRole('button', { name: 'Keep my plan' }))
    await screen.findByText(
      "We couldn't apply this offer, and your plan hasn't changed. You can still cancel."
    )
    await user.click(screen.getByRole('button', { name: 'Continue to cancel' }))

    expect(onDecide).toHaveBeenCalledExactlyOnceWith('continueToCancel')
  })

  it('does not redeem after the active workspace changed', async () => {
    const { onDecide, user } = renderOffer({ isScopeCurrent: () => false })

    await user.click(screen.getByRole('button', { name: 'Keep my plan' }))

    expect(workspaceApi.acceptRetentionOffer).not.toHaveBeenCalled()
    expect(useToastStore().add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
    expect(onDecide).toHaveBeenCalledExactlyOnceWith('dismissed')
  })
})
