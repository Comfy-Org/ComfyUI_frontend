import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SalesManagedOwnerDialog from './SalesManagedOwnerDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      subscription: {
        salesManaged: {
          planTitle: 'Your plan is managed with our sales team',
          planDescription:
            'Subscriptions for this workspace are handled by our sales team. Reach out to make changes to your plan.',
          outOfCreditsTitle: 'This workspace is out of credits',
          outOfCreditsDescription:
            'Credits for this workspace are managed with our sales team. Reach out to add more.',
          contactSales: 'Contact sales'
        }
      }
    }
  }
})

function renderComponent(props: { outOfCredits?: boolean } = {}) {
  const onClose = vi.fn()
  render(SalesManagedOwnerDialog, {
    props: { onClose, ...props },
    global: { plugins: [i18n] }
  })
  return onClose
}

describe('SalesManagedOwnerDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn())
  })

  it('renders the plan-managed copy with a Contact sales CTA by default', () => {
    renderComponent()
    expect(
      screen.getByText('Your plan is managed with our sales team')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Subscriptions for this workspace are handled by our sales team. Reach out to make changes to your plan.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Contact sales' })
    ).toBeInTheDocument()
  })

  it('renders the out-of-credits copy for the out-of-credits variant', () => {
    renderComponent({ outOfCredits: true })
    expect(
      screen.getByText('This workspace is out of credits')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Credits for this workspace are managed with our sales team. Reach out to add more.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Contact sales' })
    ).toBeInTheDocument()
  })

  it('opens the enterprise contact page from Contact sales', async () => {
    const user = userEvent.setup()
    const onClose = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Contact sales' }))

    expect(window.open).toHaveBeenCalledWith(
      'https://comfy.org/cloud/enterprise/',
      '_blank',
      'noopener,noreferrer'
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('dismisses via the header close button', async () => {
    const user = userEvent.setup()
    const onClose = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
