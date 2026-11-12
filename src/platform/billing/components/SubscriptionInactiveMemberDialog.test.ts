import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SubscriptionInactiveMemberDialog from './SubscriptionInactiveMemberDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      subscription: {
        inactive: {
          memberTitle: "This workspace's subscription is inactive",
          memberDescription:
            "Ask your workspace owner to reactivate the workspace's subscription to run workflows.",
          memberCta: 'Ok, got it'
        }
      }
    }
  }
})

function renderComponent(onClose = vi.fn()) {
  render(SubscriptionInactiveMemberDialog, {
    props: { onClose },
    global: { plugins: [i18n] }
  })
  return onClose
}

describe('SubscriptionInactiveMemberDialog', () => {
  it('renders the inactive title, description and CTA', () => {
    renderComponent()
    expect(
      screen.getByText("This workspace's subscription is inactive")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Ask your workspace owner to reactivate the workspace's subscription to run workflows."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ok, got it' })
    ).toBeInTheDocument()
  })

  it('exposes no subscribe affordance', () => {
    renderComponent()
    expect(screen.queryByText(/subscribe/i)).not.toBeInTheDocument()
  })

  it('calls onClose when the CTA is clicked', async () => {
    const user = userEvent.setup()
    const onClose = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Ok, got it' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the header close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
