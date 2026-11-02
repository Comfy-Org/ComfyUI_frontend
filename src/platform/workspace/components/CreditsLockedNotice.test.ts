import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { BillingContext } from '@/composables/billing/types'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import CreditsLockedNotice from './CreditsLockedNotice.vue'

vi.mock(import('@/composables/billing/useBillingContext'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      credits: {
        topUp: {
          planRequiredSubscribe: 'Subscribe to run',
          planRequiredResubscribe: 'Resubscribe to run'
        }
      }
    }
  }
})

function renderNotice(state: BillingContext['subscriptionStatus']['value']) {
  mockBillingContext().subscriptionStatus = computed(() => state)
  return render(CreditsLockedNotice, { global: { plugins: [i18n] } })
}

describe('CreditsLockedNotice', () => {
  it('tells a never-subscribed account to subscribe', () => {
    renderNotice(null)

    expect(screen.getByRole('status')).toHaveTextContent('Subscribe to run')
  })

  it('tells a lapsed account to resubscribe', () => {
    renderNotice('ended')

    expect(screen.getByRole('status')).toHaveTextContent('Resubscribe to run')
  })

  it('falls back to the subscribe line for any other state', () => {
    renderNotice('canceled')

    expect(screen.getByRole('status')).toHaveTextContent('Subscribe to run')
  })
})
