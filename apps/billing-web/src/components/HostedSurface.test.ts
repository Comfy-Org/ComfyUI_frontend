import { render, screen } from '@testing-library/vue'

import { parseBillingEntry } from '@comfyorg/billing-contract'

import HostedSurface from '@/components/HostedSurface.vue'
import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'

function renderSurface() {
  return render(HostedSurface, {
    slots: { default: '<p>surface content</p>' },
    global: { plugins: [createBillingI18n()] }
  })
}

describe('HostedSurface', () => {
  beforeEach(() => {
    recordBillingEntry(
      parseBillingEntry(
        '/v1/subscription?product=comfyui&return_to=comfyui_credits'
      )
    )
  })

  it('shows the surface the intent asked for', () => {
    renderSurface()

    expect(screen.getByText('surface content')).toBeInTheDocument()
  })

  it('links back to the product that sent the visitor here', () => {
    renderSurface()

    expect(
      screen.getByRole('link', { name: 'Return to ComfyUI' })
    ).toHaveAttribute(
      'href',
      'https://testcloud.comfy.org/?settings=plan-credits'
    )
  })

  it('offers no way back when the arriving link named no destination', () => {
    recordBillingEntry(undefined)

    renderSurface()

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
