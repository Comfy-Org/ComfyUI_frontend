import { render, screen } from '@testing-library/vue'
import { createMemoryHistory } from 'vue-router'

import App from '@/App.vue'
import { createBillingI18n } from '@/i18n'
import { createBillingRouter } from '@/router'

describe('billing app', () => {
  it('boots on the billing route', async () => {
    const router = createBillingRouter(createMemoryHistory())

    await router.push('/')
    await router.isReady()

    render(App, {
      global: {
        plugins: [createBillingI18n(), router]
      }
    })

    expect(
      screen.getByRole('heading', { name: 'Add credits' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Amount (USD)')).toHaveValue(50)
    expect(
      screen.getByRole('button', { name: 'Continue to checkout' })
    ).toBeDisabled()
  })

  it('recovers unknown static-host paths to the app entry route', async () => {
    const router = createBillingRouter(createMemoryHistory())

    await router.push('/unknown-path')
    await router.isReady()

    render(App, {
      global: {
        plugins: [createBillingI18n(), router]
      }
    })

    expect(
      await screen.findByRole('heading', { name: 'Add credits' })
    ).toBeInTheDocument()
  })
})
