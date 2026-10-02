import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type {
  BillingPlansData,
  BillingTelemetryEvent,
  SubscriptionCommandResult
} from '@comfyorg/account-core/billing'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import {
  challengedPendingOperation,
  createFakeBillingClient,
  failedOperation,
  hostedPendingOperation,
  planOf,
  succeededOperation
} from '@/test/fakeBillingClient'
import { trackedBillingEvents } from '@/test/trackedBillingEvents'
import SubscriptionView from '@/views/SubscriptionView.vue'

/** The values this surface and the session it sits under read; a test-family key stands in for a deployment's. */
vi.mock(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test' as const,
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

vi.mock(import('@/config/stripeKey'), () => ({
  awaitBillingWebStripeKey: () => Promise.resolve('pk_test_example')
}))

const challengeMocks = vi.hoisted(() => ({
  createPort: vi.fn(),
  handleNextAction: vi.fn(async () => ({}))
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createDeferredStripeChallengePort: (
    getKey: () => string | undefined | Promise<string | undefined>
  ) => {
    void Promise.resolve(getKey()).then((key) => challengeMocks.createPort(key))
    return {
      handleNextAction: challengeMocks.handleNextAction,
      leavesPage: () => Promise.resolve(true)
    }
  }
}))

const CATALOG: BillingPlansData = {
  current_plan_slug: 'free_monthly',
  plans: [
    planOf({
      slug: 'free_monthly',
      tier: 'FREE',
      price_cents: 0n,
      credits_cents: 0n
    }),
    planOf({ slug: 'creator_monthly', tier: 'CREATOR' })
  ]
}

const SURFACE_PATH = '/v1/subscription'
const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'

async function renderSubscription(options: FakeBillingClientOptions = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: SURFACE_PATH, component: SubscriptionView }]
  })
  const fake = createFakeBillingClient({
    plans: { status: 'ok', value: CATALOG },
    ...options
  })
  await router.push(`${SURFACE_PATH}?${ENTRY_QUERY}`)
  await router.isReady()
  const { unmount } = render(SubscriptionView, {
    global: {
      plugins: [createBillingI18n(), router],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return { ...fake, unmount }
}

describe('SubscriptionView', () => {
  beforeEach(() => {
    recordBillingEntry(parseBillingEntry(`${SURFACE_PATH}?${ENTRY_QUERY}`))
  })

  it('names the plan the workspace is on today', async () => {
    await renderSubscription()

    expect(
      await screen.findByText('Current plan: Free · Monthly')
    ).toBeInTheDocument()
  })

  it('leaves choosing a plan to the product that sent the customer', async () => {
    await renderSubscription()
    await screen.findByText('Current plan: Free · Monthly')

    expect(
      screen.queryByRole('button', { name: /^Choose/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('$28.00')).not.toBeInTheDocument()
  })

  it('offers cancel and resubscribe only when the server allows them', async () => {
    await renderSubscription()
    await screen.findByText('Current plan: Free · Monthly')

    expect(
      screen.queryByRole('button', { name: 'Cancel subscription' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Resubscribe' })
    ).not.toBeInTheDocument()
  })

  it('cancels after a confirmation and refreshes what the change touched', async () => {
    const fake = await renderSubscription({
      capabilities: { can_cancel: true },
      cancel: { status: 'ok', value: { phase: 'succeeded' } }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel subscription' })
    )
    expect(fake.cancelSubscription).not.toHaveBeenCalled()
    const confirm = screen.getByRole('button', { name: 'Confirm cancellation' })
    await waitFor(() => expect(confirm).toHaveFocus())
    await userEvent.click(confirm)

    expect(
      await screen.findByText('Your subscription is cancelled.')
    ).toBeInTheDocument()
    expect(fake.cancelSubscription).toHaveBeenCalledOnce()
    expect(fake.invalidateCapabilities).toHaveBeenCalledOnce()
    expect(fake.readCapabilities).toHaveBeenLastCalledWith({
      forceRefresh: true
    })
    expect(fake.readPlans).toHaveBeenCalledTimes(2)
  })

  it('says when a cancelled plan ends, as the server reports it', async () => {
    await renderSubscription({
      status: {
        is_active: true,
        has_funds: true,
        max_seats: 1,
        occupied_seats: 1,
        scheduled_change: null,
        team_credit_stop: null,
        subscription_status: 'canceled',
        cancel_at: '2026-10-24T12:00:00.000Z'
      }
    })

    expect(await screen.findByText('Ends on Oct 24, 2026')).toBeInTheDocument()
  })

  it('shows the end date once a cancellation lands, without a reload', async () => {
    const fake = await renderSubscription({
      capabilities: { can_cancel: true },
      cancel: { status: 'ok', value: { phase: 'succeeded' } }
    })
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel subscription' })
    )
    expect(screen.queryByText(/^Ends on/)).not.toBeInTheDocument()

    fake.readStatus.mockResolvedValue({
      status: 'ok',
      value: {
        status: {
          is_active: true,
          has_funds: true,
          max_seats: 1,
          occupied_seats: 1,
          scheduled_change: null,
          team_credit_stop: null,
          cancel_at: '2026-10-24T12:00:00.000Z'
        },
        scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
        readAt: 0
      }
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm cancellation' })
    )

    expect(await screen.findByText('Ends on Oct 24, 2026')).toBeInTheDocument()
  })

  it('drops the end date once a resubscription lands', async () => {
    const cancelled = {
      is_active: true,
      has_funds: true,
      max_seats: 1,
      occupied_seats: 1,
      scheduled_change: null,
      team_credit_stop: null,
      subscription_status: 'canceled',
      cancel_at: '2026-10-24T12:00:00.000Z'
    } as const
    const fake = await renderSubscription({
      capabilities: { can_reactivate: true },
      resubscribe: { status: 'ok', value: { phase: 'succeeded' } },
      status: cancelled
    })
    expect(await screen.findByText('Ends on Oct 24, 2026')).toBeInTheDocument()

    const { cancel_at: _, ...active } = cancelled
    fake.readStatus.mockResolvedValue({
      status: 'ok',
      value: {
        status: { ...active, subscription_status: 'active' },
        scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
        readAt: 0
      }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Resubscribe' }))

    expect(
      await screen.findByText('Your subscription is active again.')
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText(/^Ends on/)).not.toBeInTheDocument()
    )
  })

  it('keeps the plan when the customer backs out of cancelling', async () => {
    const fake = await renderSubscription({
      capabilities: { can_cancel: true }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel subscription' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Keep my plan' }))

    expect(fake.cancelSubscription).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Cancel subscription' })
      ).toHaveFocus()
    )
  })

  it('resubscribes when the server allows it', async () => {
    const fake = await renderSubscription({
      capabilities: { can_reactivate: true },
      resubscribe: { status: 'ok', value: { phase: 'succeeded' } }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Resubscribe' })
    )

    expect(
      await screen.findByText('Your subscription is active again.')
    ).toBeInTheDocument()
    expect(fake.resubscribe).toHaveBeenCalledOnce()
  })

  it('keeps the action disabled until the capability refresh lands', async () => {
    const fake = await renderSubscription({
      capabilities: { can_reactivate: true },
      resubscribe: { status: 'ok', value: { phase: 'succeeded' } }
    })
    const button = await screen.findByRole('button', { name: 'Resubscribe' })
    const granted = await fake.readCapabilities.mock.results[0].value

    let landRefresh: () => void = () => {}
    fake.readCapabilities.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          landRefresh = () => resolve(granted)
        })
    )

    await userEvent.click(button)
    await waitFor(() => expect(fake.resubscribe).toHaveBeenCalledOnce())

    // The command has settled but the capabilities behind the button have not,
    // so re-enabling here would offer a second click against stale answers.
    expect(button).toBeDisabled()

    landRefresh()
    await waitFor(() => expect(button).toBeEnabled())
    expect(fake.resubscribe).toHaveBeenCalledOnce()
  })

  it('redirects this tab when resubscribing needs a hosted payment step', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    const fake = await renderSubscription({
      capabilities: { can_reactivate: true },
      resubscribe: { status: 'ok', value: { phase: 'succeeded' } }
    })
    await userEvent.click(
      await screen.findByRole('button', { name: 'Resubscribe' })
    )

    // The outcome type carries only a terminal operation, so a pending
    // continuation cannot ride back on the command and the lifecycle stands in
    // for it here. Asserting the command ran is what keeps this a test of the
    // button rather than of the publish.
    expect(fake.resubscribe).toHaveBeenCalledOnce()
    fake.publishOperation(
      hostedPendingOperation('https://hooks.stripe.test/redirect/op_1')
    )

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        'https://hooks.stripe.test/redirect/op_1'
      )
    )
  })

  it('drives a 3DS challenge in place when resubscribing raises one', async () => {
    const fake = await renderSubscription({
      capabilities: { can_reactivate: true },
      resubscribe: { status: 'ok', value: { phase: 'succeeded' } }
    })
    expect(challengeMocks.createPort).toHaveBeenCalledWith('pk_test_example')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Resubscribe' })
    )
    expect(fake.resubscribe).toHaveBeenCalledOnce()
    fake.publishOperation(challengedPendingOperation('pi_1_secret'))

    await waitFor(() =>
      expect(challengeMocks.handleNextAction).toHaveBeenCalledWith(
        'pi_1_secret'
      )
    )
  })

  it('explains a change the server refused in our own words', async () => {
    await renderSubscription({
      capabilities: { can_cancel: true },
      cancel: { status: 'error', code: 'NO_ACTIVE_SUBSCRIPTION' }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel subscription' })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm cancellation' })
    )

    expect(
      await screen.findByText('There is no active subscription to change.')
    ).toBeInTheDocument()
  })

  it('explains a cancel refused while an earlier payment is still open', async () => {
    await renderSubscription({
      capabilities: { can_cancel: true },
      cancel: { status: 'error', code: 'OPERATION_ALREADY_PENDING' }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel subscription' })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm cancellation' })
    )

    expect(
      await screen.findByText(
        'A payment you started earlier is still going through. It has to finish before you can choose a different plan.'
      )
    ).toBeInTheDocument()
  })

  it('explains a failed catalog read with copy of our own', async () => {
    await renderSubscription({
      plans: { status: 'error', code: 'REQUEST_FAILED' }
    })

    expect(
      await screen.findByText(
        "We couldn't reach the billing service. Please try again."
      )
    ).toBeInTheDocument()
  })

  describe('cancel flow telemetry', () => {
    const PRO_ANNUAL: BillingPlansData = {
      current_plan_slug: 'pro_annual',
      plans: [planOf({ slug: 'pro_annual', tier: 'PRO', duration: 'ANNUAL' })]
    }

    const flow = {
      operation: 'cancel',
      billing_client: 'sdk',
      current_tier: 'pro',
      cycle: 'yearly'
    } as const

    const INTENT: BillingTelemetryEvent = {
      ...flow,
      stage: 'intent',
      outcome: 'pending'
    }

    function cancelEvents(sent: () => BillingTelemetryEvent[]) {
      return sent().filter((event) => event.operation === 'cancel')
    }

    async function openCancelFlow(cancel?: SubscriptionCommandResult) {
      const sent = trackedBillingEvents()
      const view = await renderSubscription({
        capabilities: { can_cancel: true },
        plans: { status: 'ok', value: PRO_ANNUAL },
        ...(cancel ? { cancel } : {})
      })
      await screen.findByText('Current plan: Pro · Yearly')
      await userEvent.click(
        screen.getByRole('button', { name: 'Cancel subscription' })
      )
      return { sent, view }
    }

    it('reports opening the confirmation and keeping the plan', async () => {
      const { sent } = await openCancelFlow()

      await userEvent.click(
        screen.getByRole('button', { name: 'Keep my plan' })
      )

      expect(cancelEvents(sent)).toEqual([
        INTENT,
        { ...flow, stage: 'abandoned', outcome: 'pending' }
      ])
    })

    it('reports leaving the page while the confirmation is open as abandoned', async () => {
      const { sent, view } = await openCancelFlow()

      view.unmount()

      expect(cancelEvents(sent)).toEqual([
        INTENT,
        { ...flow, stage: 'abandoned', outcome: 'pending' }
      ])
    })

    it.for<{ name: string; cancel: SubscriptionCommandResult }>([
      {
        name: 'a cancel the server settled',
        cancel: {
          status: 'ok',
          value: { phase: 'succeeded', operation: succeededOperation() }
        }
      },
      {
        name: 'a cancel operation that failed',
        cancel: {
          status: 'ok',
          value: { phase: 'failed', operation: failedOperation('card_declined') }
        }
      },
      {
        name: 'a cancel that already held',
        cancel: { status: 'ok', value: { phase: 'succeeded' } }
      }
    ])(
      'leaves the end of $name to the operation events',
      async ({ cancel }) => {
        const { sent, view } = await openCancelFlow(cancel)

        await userEvent.click(
          screen.getByRole('button', { name: 'Confirm cancellation' })
        )
        await waitFor(() =>
          expect(view.cancelSubscription).toHaveBeenCalledOnce()
        )
        view.unmount()

        expect(cancelEvents(sent)).toEqual([INTENT])
      }
    )

    it.for<{
      name: string
      cancel: SubscriptionCommandResult
      failure: Record<string, string>
    }>([
      {
        name: 'a request that never reached the server',
        cancel: { status: 'error', code: 'REQUEST_FAILED' },
        failure: { failure_category: 'network' }
      },
      {
        name: 'no subscription to cancel',
        cancel: { status: 'error', code: 'NO_ACTIVE_SUBSCRIPTION' },
        failure: { failure_category: 'api_rejected' }
      },
      {
        name: 'an earlier payment still open',
        cancel: { status: 'error', code: 'OPERATION_ALREADY_PENDING' },
        failure: {
          failure_category: 'api_rejected',
          error_code: 'operation_already_pending'
        }
      }
    ])(
      'reports $name as a failed cancel before any operation exists',
      async ({ cancel, failure }) => {
        const { sent } = await openCancelFlow(cancel)

        await userEvent.click(
          screen.getByRole('button', { name: 'Confirm cancellation' })
        )

        await waitFor(() =>
          expect(cancelEvents(sent)).toEqual([
            INTENT,
            { ...flow, stage: 'failed', outcome: 'failure', ...failure }
          ])
        )
      }
    )
  })
})
