import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import SubscriptionPromoCodeField from './SubscriptionPromoCodeField.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

describe('SubscriptionPromoCodeField', () => {
  it('waits for explicit Apply before emitting a promotion code', async () => {
    const user = userEvent.setup()
    const { emitted } = render(SubscriptionPromoCodeField, {
      global: { plugins: [i18n] }
    })

    await user.click(
      screen.getByRole('button', {
        name: 'subscription.preview.addPromoCode'
      })
    )
    await user.type(screen.getByRole('textbox'), ' SAVE20 ')
    expect(emitted().apply).toBeUndefined()

    await user.click(
      screen.getByRole('button', {
        name: 'subscription.preview.applyPromoCode'
      })
    )
    expect(emitted().apply).toEqual([['SAVE20']])
  })

  it('renders backend validation feedback without marking the code applied', async () => {
    const user = userEvent.setup()
    render(SubscriptionPromoCodeField, {
      props: { error: 'Promotion code is invalid' },
      global: { plugins: [i18n] }
    })

    await user.click(
      screen.getByRole('button', {
        name: 'subscription.preview.addPromoCode'
      })
    )
    expect(screen.getByText('Promotion code is invalid')).toBeTruthy()
  })
})
