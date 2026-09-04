import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import PlanManagedMemberDialog from './PlanManagedMemberDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      subscription: {
        managedByOwner: {
          memberTitle: "This workspace's plan is managed by its owner",
          memberDescription:
            "Ask your workspace owner to make changes to the workspace's plan.",
          memberCta: 'Ok, got it'
        }
      }
    }
  }
})

function renderComponent(onClose = vi.fn()) {
  render(PlanManagedMemberDialog, {
    props: { onClose },
    global: { plugins: [i18n] }
  })
  return onClose
}

describe('PlanManagedMemberDialog', () => {
  it('renders the managed-by-owner copy without an inactive alarm', () => {
    renderComponent()
    expect(
      screen.getByText("This workspace's plan is managed by its owner")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Ask your workspace owner to make changes to the workspace's plan."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/inactive/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ok, got it' })
    ).toBeInTheDocument()
  })

  it('calls onClose from the CTA and the header close button', async () => {
    const user = userEvent.setup()
    const onClose = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Ok, got it' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
