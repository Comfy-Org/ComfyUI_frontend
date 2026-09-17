import { render, screen } from '@testing-library/vue'

import { BILLING_CLIENT_KEY } from '@comfyorg/account-ui/billing'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import type { FakeBillingClientOptions } from '@/test/fakeBillingClient'
import {
  createFakeBillingClient,
  pendingOperation,
  succeededOperation
} from '@/test/fakeBillingClient'
import ResultView from '@/views/ResultView.vue'

const RESULT_PATH = '/v1/result?product=comfyui&return_to=comfyui_workspace'

vi.mock(import('@/session/stripeChallengePort'), () => ({
  createStripeChallengePort: () => ({
    handleNextAction: () => Promise.resolve({})
  })
}))

function renderResult(options: FakeBillingClientOptions = {}) {
  recordBillingEntry(parseBillingEntry(RESULT_PATH))
  const fake = createFakeBillingClient(options)
  render(ResultView, {
    global: {
      plugins: [createBillingI18n()],
      provide: { [BILLING_CLIENT_KEY]: fake.client }
    }
  })
  return fake
}

describe('ResultView', () => {
  it('recovers what the scope is waiting on and shows where it stands', async () => {
    const fake = renderResult({
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

  it('reports success on the way back once the operation settled', async () => {
    renderResult({ recover: { status: 'ok', value: succeededOperation() } })

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
    renderResult()

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
