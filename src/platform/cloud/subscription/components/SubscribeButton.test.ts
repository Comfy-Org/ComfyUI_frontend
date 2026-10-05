import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useTelemetry } from '@/platform/telemetry'

import SubscribeButton from './SubscribeButton.vue'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

function renderComponent() {
  vi.mocked(useBillingContext).mockReturnValue({
    ...useBillingContext(),
    tier: computed(() => 'STANDARD')
  })

  return render(SubscribeButton, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        }),
        getActivePinia()!
      ]
    }
  })
}

describe('SubscribeButton', () => {
  beforeEach(() => {
    vi.mocked(useTelemetry())!.trackSubscription.mockClear()
  })

  it('names its own surface on the subscribe event', async () => {
    renderComponent()

    await userEvent.click(screen.getByRole('button'))

    expect(useTelemetry()!.trackSubscription).toHaveBeenCalledExactlyOnceWith(
      'subscribe_clicked',
      { current_tier: 'standard', reason: 'subscribe_now_button' }
    )
  })
})
