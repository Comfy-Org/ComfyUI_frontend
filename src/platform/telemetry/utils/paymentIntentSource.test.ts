import type { CheckoutEntrySource } from '@comfyorg/account-core/billing'
import { isBillingSource } from '@comfyorg/billing-contract'
import { describe, expect, it } from 'vitest'

import type { AddCreditsClickMetadata, PaymentIntentSource } from '../types'
import {
  paymentIntentSourceForAddCreditsClick,
  paymentIntentSourceForJourneyEntry
} from './paymentIntentSource'

describe('the add-credits click source', () => {
  it.for<{
    clicked: AddCreditsClickMetadata['source']
    reported: PaymentIntentSource
  }>([
    { clicked: 'credits_panel', reported: 'settings_billing_panel' },
    { clicked: 'avatar_menu', reported: 'avatar_menu_plans' },
    { clicked: 'settings_billing_panel', reported: 'settings_billing_panel' },
    { clicked: 'deep_link', reported: 'deep_link' },
    { clicked: 'agent_paywall', reported: 'agent_paywall' }
  ])('maps $clicked to $reported in the one source list', (row) => {
    expect(paymentIntentSourceForAddCreditsClick(row.clicked)).toBe(
      row.reported
    )
    expect(isBillingSource(row.reported)).toBe(true)
  })
})

describe('the checkout journey entry source', () => {
  it.for<{
    entry: CheckoutEntrySource
    reported: PaymentIntentSource | undefined
  }>([
    { entry: 'deep_link', reported: 'deep_link' },
    { entry: 'settings_billing', reported: 'settings_billing_panel' },
    { entry: 'agent_paywall', reported: 'agent_paywall' },
    { entry: 'pricing', reported: undefined },
    { entry: 'recovery', reported: undefined },
    { entry: 'other', reported: undefined },
    { entry: 'unknown', reported: undefined }
  ])('maps $entry to $reported in the one source list', (row) => {
    expect(paymentIntentSourceForJourneyEntry(row.entry)).toBe(row.reported)
  })
})
