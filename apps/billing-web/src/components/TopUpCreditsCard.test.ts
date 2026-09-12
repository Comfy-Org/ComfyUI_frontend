import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import { createBillingI18n } from '@/i18n'

import TopUpCreditsCard from './TopUpCreditsCard.vue'

function renderCard() {
  return render(TopUpCreditsCard, {
    global: { plugins: [createBillingI18n()] }
  })
}

describe('TopUpCreditsCard', () => {
  it('requests checkout in cents for the selected preset', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard()

    await user.click(screen.getByRole('button', { name: '$25' }))
    await user.click(
      screen.getByRole('button', { name: 'Continue to checkout' })
    )

    expect(emitted().checkout).toEqual([[2500]])
    expect(screen.getAllByText('5,275 Credits')).toHaveLength(1)
  })

  it('rejects amounts outside the supported purchase range', async () => {
    const user = userEvent.setup()
    renderCard()

    const amountInput = screen.getByLabelText('Amount (USD)')
    const checkoutButton = screen.getByRole('button', {
      name: 'Continue to checkout'
    })

    await user.clear(amountInput)
    await user.type(amountInput, '4')
    expect(screen.getByText('$5 minimum')).toBeInTheDocument()
    expect(checkoutButton).toBeDisabled()

    await user.clear(amountInput)
    await user.type(amountInput, '10001')
    expect(screen.getByText('$10,000 maximum')).toBeInTheDocument()
    expect(checkoutButton).toBeDisabled()
  })
})
