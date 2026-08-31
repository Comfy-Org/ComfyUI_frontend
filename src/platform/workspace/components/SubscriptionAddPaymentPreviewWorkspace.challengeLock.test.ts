import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'

/**
 * Kept apart from the sibling suite, which mocks `vue-i18n` and so can only
 * assert translation keys. These assertions name the buttons the way a
 * customer reads them, which is also the only way a missing string shows up
 * as a failure rather than as a passing test against a raw key.
 */
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

const savedCard = {
  id: 'pm_1',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
} as const

const secondCard = {
  id: 'pm_2',
  type: 'card',
  brand: 'mastercard',
  last4: '5454',
  is_default: false
} as const

function renderPreview(props: Record<string, unknown> = {}) {
  return render(SubscriptionAddPaymentPreviewWorkspace, {
    props: {
      tierKey: 'creator',
      usePaymentElement: true,
      embeddedCheckoutEnabled: true,
      savedMethods: [savedCard],
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: { UnifiedStripePaymentSelector: true }
    }
  })
}

/** Two methods swap the single-method Change button for the picker. */
function renderPicker(props: Record<string, unknown> = {}) {
  return renderPreview({ savedMethods: [savedCard, secondCard], ...props })
}

describe('SubscriptionAddPaymentPreviewWorkspace — challenge lock', () => {
  it.for([
    ['an open bank tab', { actionUrl: 'https://verify.example/token' }],
    ['requires_action', { authenticationState: 'requires_action' }],
    ['failed_retryable', { authenticationState: 'failed_retryable' }],
    ['a reconciliation hold', { reconciliationOperationId: 'op_1' }]
  ] as const)('locks back and the method row during %s', ([, props]) => {
    renderPreview(props)

    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled()
  })

  it('leaves both usable before a charge is in flight', () => {
    renderPreview()

    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Change' })).toBeEnabled()
  })

  it.for([
    ['an open bank tab', { actionUrl: 'https://verify.example/token' }],
    ['requires_action', { authenticationState: 'requires_action' }],
    ['failed_retryable', { authenticationState: 'failed_retryable' }],
    ['a reconciliation hold', { reconciliationOperationId: 'op_1' }]
  ] as const)('locks the saved-method picker during %s', ([, props]) => {
    renderPicker(props)

    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('leaves the picker usable before a charge is in flight', () => {
    renderPicker()

    expect(screen.getByRole('combobox')).toBeEnabled()
  })
})
