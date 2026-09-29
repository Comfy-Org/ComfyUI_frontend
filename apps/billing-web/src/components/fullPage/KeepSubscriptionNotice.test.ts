import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import type { KeepSubscriptionConsent } from '@/components/fullPage/KeepSubscriptionNotice.vue'
import KeepSubscriptionNotice from '@/components/fullPage/KeepSubscriptionNotice.vue'
import { createBillingI18n } from '@/i18n'

const COPY = {
  title: 'Your plan was set to end on July 28, 2026',
  body: 'Upgrading keeps your subscription, and it renews that day at $100.00.'
}

function renderNotice(state: KeepSubscriptionConsent['state']) {
  return render(KeepSubscriptionNotice, {
    props: { consent: { state, copy: COPY } },
    global: { plugins: [createBillingI18n()] }
  })
}

const box = () =>
  screen.getByRole('checkbox', { name: 'Keep my subscription and renew it' })

describe('KeepSubscriptionNotice', () => {
  it.for<{
    state: KeepSubscriptionConsent['state']
    checked: boolean
    invalid: boolean
  }>([
    { state: 'required', checked: false, invalid: false },
    { state: 'invalid', checked: false, invalid: true },
    { state: 'confirmed', checked: true, invalid: false }
  ])('renders $state', ({ state, checked, invalid }) => {
    renderNotice(state)

    expect(screen.getByText(COPY.title)).toBeInTheDocument()
    expect(screen.getByText(COPY.body)).toBeInTheDocument()
    expect(box()).toHaveProperty('checked', checked)
    expect(box()).toHaveAttribute('aria-invalid', String(invalid))
    if (invalid) {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Check the box to keep your subscription, then pay.'
      )
      expect(box()).toHaveAccessibleDescription(
        'Check the box to keep your subscription, then pay.'
      )
    } else {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    }
  })

  it('hands focus to the box once a Pay is refused for the missing tick', async () => {
    const { rerender } = renderNotice('required')
    expect(box()).not.toHaveFocus()

    await rerender({ consent: { state: 'invalid', copy: COPY } })

    expect(box()).toHaveFocus()
  })

  it('emits the tick and the untick', async () => {
    const { emitted, rerender } = renderNotice('required')

    await userEvent.click(box())
    expect(emitted('confirm')).toEqual([[true]])

    await rerender({ consent: { state: 'confirmed', copy: COPY } })
    await userEvent.click(box())
    expect(emitted('confirm')).toEqual([[true], [false]])
  })
})
