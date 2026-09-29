import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'

import type { CheckoutUiVariant } from '@/config/checkoutUi'
import { awaitCheckoutUiVariant } from '@/config/checkoutUi'
import { createBillingI18n } from '@/i18n'
import CheckoutRouteView from '@/views/CheckoutRouteView.vue'

vi.mock(import('@/config/checkoutUi'), { spy: true })

vi.mock(import('@/views/CheckoutView.vue'), async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({ render: () => h('h1', 'Embedded checkout') })
  }
})

vi.mock(import('@/views/FullPageCheckoutView.vue'), async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({ render: () => h('h1', 'Full-page checkout') })
  }
})

const HEADINGS: Record<CheckoutUiVariant, string> = {
  embedded: 'Embedded checkout',
  full_page: 'Full-page checkout'
}

function renderRoute() {
  render(CheckoutRouteView, { global: { plugins: [createBillingI18n()] } })
}

describe('CheckoutRouteView', () => {
  it('shows only the loading frame until the variant is known', async () => {
    vi.mocked(awaitCheckoutUiVariant).mockReturnValue(
      new Promise(() => undefined)
    )
    renderRoute()
    await nextTick()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it.for<{ variant: CheckoutUiVariant; other: CheckoutUiVariant }>([
    { variant: 'embedded', other: 'full_page' },
    { variant: 'full_page', other: 'embedded' }
  ])(
    'renders only the $variant checkout once it is known',
    async ({ variant, other }) => {
      vi.mocked(awaitCheckoutUiVariant).mockResolvedValue(variant)
      renderRoute()

      expect(
        await screen.findByRole('heading', { name: HEADINGS[variant] })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: HEADINGS[other] })
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    }
  )
})
