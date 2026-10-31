import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import CreditsLockedNotice from './CreditsLockedNotice.vue'

const subscriptionState: Ref<'never_subscribed' | 'ended' | null> = ref(null)

vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingContext'),
  () => ({
    useBillingContext: () => ({ subscriptionState })
  })
)

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

function renderNotice() {
  return render(CreditsLockedNotice, { global: { plugins: [i18n] } })
}

describe('CreditsLockedNotice', () => {
  beforeEach(() => {
    subscriptionState.value = null
  })

  it('tells a never-subscribed account to subscribe', () => {
    subscriptionState.value = 'never_subscribed'
    renderNotice()

    expect(screen.getByRole('status')).toHaveTextContent('Subscribe to run')
  })

  it('tells a lapsed account to resubscribe', () => {
    subscriptionState.value = 'ended'
    renderNotice()

    expect(screen.getByRole('status')).toHaveTextContent('Resubscribe to run')
  })

  it('falls back to the subscribe line while the state is unknown', () => {
    renderNotice()

    expect(screen.getByRole('status')).toHaveTextContent('Subscribe to run')
  })
})
