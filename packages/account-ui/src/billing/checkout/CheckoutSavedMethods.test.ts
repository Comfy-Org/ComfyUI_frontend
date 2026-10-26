import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'

import CheckoutSavedMethods from './CheckoutSavedMethods.vue'
import { checkoutCopy } from './__fixtures__/copy'

const card: SavedPaymentMethod = {
  id: 'pm_card',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
}
const alipay: SavedPaymentMethod = {
  id: 'pm_alipay',
  type: 'alipay',
  is_default: false
}

function renderMethods(methods: SavedPaymentMethod[]) {
  const onChangePaymentMethod = vi.fn()
  const onUpdate = vi.fn()
  render(CheckoutSavedMethods, {
    props: {
      methods,
      copy: checkoutCopy.savedMethod,
      selectedMethodId: 'pm_card',
      onChangePaymentMethod,
      'onUpdate:selectedMethodId': onUpdate
    }
  })
  return { onChangePaymentMethod, onUpdate }
}

describe('CheckoutSavedMethods', () => {
  it('labels a linked Alipay account without card details', () => {
    renderMethods([alipay])
    expect(screen.getByText('Alipay')).toBeTruthy()
  })

  it('selects another saved method from the picker', async () => {
    const { onUpdate, onChangePaymentMethod } = renderMethods([card, alipay])
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByRole('option', { name: 'Alipay' }))
    expect(onUpdate).toHaveBeenCalledWith('pm_alipay')
    expect(onChangePaymentMethod).not.toHaveBeenCalled()
  })

  it('clears the selection and asks for a new method from its last option', async () => {
    const { onUpdate, onChangePaymentMethod } = renderMethods([card, alipay])
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(
      screen.getByRole('option', { name: 'Add new payment method' })
    )
    expect(onUpdate).toHaveBeenCalledWith(null)
    expect(onChangePaymentMethod).toHaveBeenCalledOnce()
  })
})
