import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

// The ended banner's own CTA label — deliberately NOT the ending banner's
// "Resume subscription": an ended plan is past resuming, the CTA starts a
// new subscription. Guarded: an undefined name would silently drop the
// accessible-name filter and match any button.
const resumeLabel: string = enMessages.workspacePanel.members.resubscribe
if (!resumeLabel) {
  throw new Error('workspacePanel.members.resubscribe is gone from the bundle')
}

import MemberUpsellBanner from './MemberUpsellBanner.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderBanner(
  props: {
    variant: 'upgrade' | 'reactivate' | 'contactSales'
    enterprise?: boolean
  } = {
    variant: 'upgrade'
  }
) {
  return render(MemberUpsellBanner, {
    props,
    global: { plugins: [i18n] }
  })
}

describe('MemberUpsellBanner', () => {
  it('shows upgrade copy when the workspace never subscribed', () => {
    renderBanner({ variant: 'upgrade' })

    expect(
      screen.getByText('To add teammates, upgrade your plan.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Upgrade to Team' })
    ).toBeInTheDocument()
  })

  it('shows the ended title and resume action for an ended team plan', () => {
    renderBanner({ variant: 'reactivate' })

    expect(screen.getByText('Your team plan has ended')).toBeInTheDocument()
    expect(
      screen.getByText('To add more teammates, reactivate your plan.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: resumeLabel })
    ).toBeInTheDocument()
  })

  it('keeps an unrecognized tier on the sales route with plan-neutral copy', () => {
    renderBanner({ variant: 'contactSales' })

    expect(screen.getByText('Your plan has ended')).toBeInTheDocument()
    expect(
      screen.getByText('Contact sales to reactivate your plan.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Enterprise/)).not.toBeInTheDocument()
  })

  it('routes an ended Enterprise plan to sales, not reactivation', () => {
    renderBanner({ variant: 'contactSales', enterprise: true })

    expect(
      screen.getByText('Your Enterprise plan has ended')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Contact sales to reactivate your Enterprise plan.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Contact sales' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: resumeLabel })
    ).not.toBeInTheDocument()
  })

  it('emits action when the CTA is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderBanner({ variant: 'reactivate' })

    await user.click(screen.getByRole('button', { name: resumeLabel }))

    expect(emitted()).toHaveProperty('action')
  })
})
