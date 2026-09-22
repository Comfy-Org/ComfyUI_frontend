import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { BillingPlansData } from '@comfyorg/account-core/billing'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import {
  challengedPendingOperation,
  createFakeBillingClient,
  hostedPendingOperation,
  planOf,
  previewOf
} from '@/test/fakeBillingClient'
import SubscriptionView from '@/views/SubscriptionView.vue'

/** The two values this surface reads; a test-family key stands in for a deployment's. */
vi.mock(import('@/config/env'), () => ({
  BILLING_WEB_ENV: 'test' as const
}))

vi.mock(import('@/config/stripeKey'), () => ({
  billingWebStripeKey: () => 'pk_test_example'
}))

const challengeMocks = vi.hoisted(() => ({
  createPort: vi.fn(),
  handleNextAction: vi.fn(async () => ({}))
}))

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createDeferredStripeChallengePort: (getKey: () => string | undefined) => {
    challengeMocks.createPort(getKey())
    return { handleNextAction: challengeMocks.handleNextAction }
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
    planOf({ slug: 'creator_monthly', tier: 'CREATOR' }),
    planOf({
      slug: 'team_monthly',
      tier: 'TEAM',
      max_seats: 5n,
      price_cents: 9900n,
      credits_cents: 20_000n,
      availability: { available: false, reason: 'requires_team' }
    })
  ]
}

const SURFACE_PATH = '/v1/subscription'
const ENTRY_QUERY = 'product=comfyui&return_to=comfyui_workspace'

async function renderSubscription(options: FakeBillingClientOptions = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: SURFACE_PATH, component: SubscriptionView },
      { path: '/v1/checkout', component: { template: '<div />' } }
    ]
  })
  const fake = createFakeBillingClient({
    plans: { status: 'ok', value: CATALOG },
    preview: { status: 'ok', value: previewOf() },
    ...options
  })
  await router.push(`${SURFACE_PATH}?${ENTRY_QUERY}`)
  await router.isReady()
  render(SubscriptionView, {
    global: {
      plugins: [createBillingI18n(), router],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return { ...fake, router }
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
    expect(screen.getByText('Current plan')).toBeInTheDocument()
  })

  it('prices every plan the catalog offers', async () => {
    await renderSubscription()

    expect(await screen.findByText('$28.00')).toBeInTheDocument()
    expect(screen.getByText('$69.00 in monthly credits')).toBeInTheDocument()
    expect(screen.getByText('5 seats')).toBeInTheDocument()
  })

  it('blocks a plan the workspace cannot move to and says why', async () => {
    await renderSubscription()

    expect(
      await screen.findByRole('button', { name: 'Choose Team · Monthly' })
    ).toBeDisabled()
    expect(
      screen.getByText('This plan is only available to team workspaces.')
    ).toBeInTheDocument()
  })

  it('quotes the chosen plan and carries it into checkout', async () => {
    const fake = await renderSubscription()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Choose Creator · Monthly' })
    )

    expect(fake.previewSubscribe).toHaveBeenCalledWith(
      { planSlug: 'creator_monthly' },
      expect.anything()
    )
    expect(await screen.findByText('Upgrade')).toBeInTheDocument()
    expect(screen.getByText('Oct 1, 2026')).toBeInTheDocument()
    expect(screen.getByText('Cost today')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Continue to checkout' })
    )

    expect(fake.router.currentRoute.value.fullPath).toBe(
      `/v1/checkout?${ENTRY_QUERY}&plan=creator_monthly`
    )
  })

  it('explains a quote the server will not allow', async () => {
    const fake = await renderSubscription({
      preview: { status: 'ok', value: previewOf({ allowed: false }) }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Choose Creator · Monthly' })
    )

    expect(fake.previewSubscribe).toHaveBeenCalled()
    expect(
      await screen.findByText("This plan change isn't available right now.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue to checkout' })
    ).toBeDisabled()
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
})
