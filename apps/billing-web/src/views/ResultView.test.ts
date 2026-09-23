import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'

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

const RESULT_QUERY = 'product=comfyui&return_to=comfyui_workspace'
const RESULT_PATH = `/v1/result?${RESULT_QUERY}&plan=creator_monthly`

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createStripeChallengePort: () => ({
    handleNextAction: () => Promise.resolve({})
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
  it('recovers what the scope is waiting on and shows where it stands', async () => {
    const fake = await renderResult({
      recover: {
        status: 'ok',
        value: pendingOperation()
      }
    })

    const step = await screen.findByRole('region', { name: 'Review payment' })
    expect(fake.recover).toHaveBeenCalledOnce()
    expect(step).toHaveAttribute('data-billing-step', 'preview')
    expect(
      screen.getByRole('link', { name: 'Return to ComfyUI' })
    ).toHaveAttribute(
      'href',
      'https://testcloud.comfy.org/?billing_result=pending&billing_ref=op_1'
    )
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
