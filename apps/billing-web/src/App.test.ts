import { render, screen } from '@testing-library/vue'
import { createMemoryHistory } from 'vue-router'

import App from '@/App.vue'
import { createBillingI18n } from '@/i18n'
import { createBillingRouter } from '@/router'

describe('billing app', () => {
  it('boots on the billing route', async () => {
    const router = createBillingRouter(
      createMemoryHistory(),
      () => 'authenticated'
    )

    await router.push('/')
    await router.isReady()

    render(App, {
      global: {
        plugins: [createBillingI18n(), router]
      }
    })

    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Open billing from your Comfy product to manage your plan, payment methods and invoices.'
      )
    ).toBeInTheDocument()
  })
})
