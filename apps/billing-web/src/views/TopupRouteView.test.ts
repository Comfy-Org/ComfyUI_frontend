import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'

import type { CheckoutUiVariant } from '@/config/checkoutUi'
import { awaitCheckoutUiVariant } from '@/config/checkoutUi'
import { createBillingI18n } from '@/i18n'
import TopupRouteView from '@/views/TopupRouteView.vue'

vi.mock(import('@/config/checkoutUi'), { spy: true })

vi.mock(import('@/views/FullPageTopupView.vue'), async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({ render: () => h('h1', 'Full-page top-up') })
  }
})

function renderRoute() {
  render(TopupRouteView, { global: { plugins: [createBillingI18n()] } })
}

describe('TopupRouteView', () => {
  it('shows only the loading frame until the variant is known', async () => {
    vi.mocked(awaitCheckoutUiVariant).mockReturnValue(
      new Promise(() => undefined)
    )
    renderRoute()
    await nextTick()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it.for<CheckoutUiVariant>(['embedded', 'full_page'])(
    'opens the full-page top-up on the %s variant, since there is no embedded top-up',
    async (variant) => {
      vi.mocked(awaitCheckoutUiVariant).mockResolvedValue(variant)
      renderRoute()

      expect(
        await screen.findByRole('heading', { name: 'Full-page top-up' })
      ).toBeInTheDocument()
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    }
  )
})
