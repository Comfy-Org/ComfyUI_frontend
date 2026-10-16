import { datadogRum } from '@datadog/browser-rum'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { SucceededBillingOperation } from '@comfyorg/account-core/billing'
import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import {
  createFakeBillingClient,
  failedOperation,
  pendingOperation,
  succeededOperation
} from '@/test/fakeBillingClient'
import ResultView from '@/views/ResultView.vue'

vi.mock(import('@datadog/browser-rum'))

const RESULT_QUERY = 'product=comfyui&return_to=comfyui_workspace'
const RESULT_PATH = `/v1/result?${RESULT_QUERY}&plan=creator_monthly`

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createDeferredStripeChallengePort: () => ({
    handleNextAction: () => Promise.resolve({}),
    leavesPage: () => Promise.resolve(true)
  })
}))

async function renderResult(options: FakeBillingClientOptions = {}) {
  recordBillingEntry(parseBillingEntry(RESULT_PATH))
  const fake = createFakeBillingClient(options)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/v1/result', component: ResultView },
      { path: '/v1/checkout', component: { template: '<div />' } }
    ]
  })
  await router.push(RESULT_PATH)
  await router.isReady()
  render(ResultView, {
    global: {
      plugins: [createBillingI18n(), router],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return { ...fake, router }
}

describe('ResultView', () => {
  it('recovers what the scope is waiting on and says it is still checking while the server settles', async () => {
    const fake = await renderResult({
      recover: {
        status: 'ok',
        value: pendingOperation()
      }
    })

    await vi.waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Return to ComfyUI' })
      ).toHaveAttribute(
        'href',
        'https://testcloud.comfy.org/?billing_result=pending&billing_ref=op_1'
      )
    )
    expect(fake.recover).toHaveBeenCalledOnce()
    expect(screen.getByText('Checking on your payment…')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Review payment' })).toBeNull()
  })

  it('says the recovery failed rather than that no payment exists', async () => {
    await renderResult({ recover: { status: 'error', code: 'REQUEST_FAILED' } })

    expect(
      await screen.findByText(
        "We couldn't reach the billing service. Please try again."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText('There is no payment in progress for this workspace.')
    ).toBeNull()
  })

  it('sends a retry to the payment form, which is where a new attempt starts', async () => {
    const user = userEvent.setup()
    const { router } = await renderResult({
      recover: { status: 'ok', value: failedOperation('card_declined') }
    })

    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    // The product, the return target and the plan have to survive the hop, or
    // the customer lands on a checkout that cannot quote anything.
    expect(router.currentRoute.value.fullPath).toBe(
      `/v1/checkout?${RESULT_QUERY}&plan=creator_monthly`
    )
  })

  it('reports success on the way back once the operation settled', async () => {
    await renderResult({
      recover: { status: 'ok', value: succeededOperation() }
    })

    const step = await screen.findByRole('region', {
      name: 'Payment complete'
    })
    expect(step).toHaveAttribute('data-billing-step', 'success')
    expect(
      screen.getByRole('link', { name: 'Return to ComfyUI' })
    ).toHaveAttribute(
      'href',
      'https://testcloud.comfy.org/?billing_result=success&billing_ref=op_1'
    )
  })

  it('says so when there is nothing to recover', async () => {
    await renderResult()

    expect(
      await screen.findByText(
        'There is no payment in progress for this workspace.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Return to ComfyUI' })
    ).toHaveAttribute(
      'href',
      'https://testcloud.comfy.org/?billing_result=pending'
    )
  })
})

describe('ResultView subscription checkout telemetry', () => {
  const AWAITED = { awaitedHere: true, attemptStartedAt: 0 } as const

  function reportedSubscriptionCheckout() {
    return vi
      .mocked(datadogRum.addAction)
      .mock.calls.filter(([name]) =>
        name.startsWith('billing.subscription_checkout.')
      )
      .map(([name, context]) => ({ name, context }))
  }

  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(datadogRum.addAction).mockClear()
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub',
      applicationId: 'app'
    })
  })

  it('reports the terminal of a subscribe this tab paid for on a provider page', async () => {
    await renderResult({
      recover: {
        status: 'ok',
        value: {
          ...succeededOperation('op_returned'),
          ...AWAITED,
          phase: 'succeeded',
          receipt: {
            plan: { slug: 'pro_annual', tier: 'PRO', duration: 'ANNUAL' }
          }
        } satisfies SucceededBillingOperation
      }
    })

    await vi.waitFor(() =>
      expect(reportedSubscriptionCheckout()).toEqual([
        {
          name: 'billing.subscription_checkout.succeeded',
          context: expect.objectContaining({
            billing_op_id: 'op_returned',
            checkout_ui: 'embedded',
            outcome: 'success',
            tier: 'pro',
            cycle: 'yearly'
          })
        }
      ])
    )
  })

  it('reports a provider decline as the failed terminal', async () => {
    await renderResult({
      recover: {
        status: 'ok',
        value: {
          ...failedOperation('card_declined', 'op_declined'),
          ...AWAITED
        }
      }
    })

    await vi.waitFor(() =>
      expect(reportedSubscriptionCheckout()).toEqual([
        {
          name: 'billing.subscription_checkout.failed',
          context: expect.objectContaining({
            billing_op_id: 'op_declined',
            failure_category: 'provider_decline',
            decline_reason: 'card_declined'
          })
        }
      ])
    )
  })

  it('reports nothing for an operation this tab did not start', async () => {
    await renderResult({
      recover: { status: 'ok', value: succeededOperation('op_elsewhere') }
    })

    await vi.waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Return to ComfyUI' })
      ).toHaveAttribute(
        'href',
        'https://testcloud.comfy.org/?billing_result=success&billing_ref=op_elsewhere'
      )
    )
    expect(reportedSubscriptionCheckout()).toEqual([])
  })

  it('counts one operation once when the page is opened again', async () => {
    const returned = {
      status: 'ok',
      value: { ...succeededOperation('op_reloaded'), ...AWAITED }
    } as const
    await renderResult({ recover: returned })
    await vi.waitFor(() =>
      expect(reportedSubscriptionCheckout()).toHaveLength(1)
    )

    await renderResult({ recover: returned })

    await vi.waitFor(() =>
      expect(
        screen.getAllByRole('link', { name: 'Return to ComfyUI' })
      ).toHaveLength(2)
    )
    expect(reportedSubscriptionCheckout()).toHaveLength(1)
  })
})
