import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import FreeTierQuota from './FreeTierQuota.vue'

const mockIsFreeTier = ref(true)
const mockShowSubscriptionDialog = vi.fn()

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isFreeTier: mockIsFreeTier,
    showSubscriptionDialog: mockShowSubscriptionDialog
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useFreeTierQuota', () => ({
  useFreeTierQuota: () => ({
    available: computed(() => 3),
    hasInvalidNodes: computed(() => false),
    maxAvailable: computed(() => 5),
    quotaEnabled: computed(() => true)
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      actionbar: {
        freeTierRuns: '{available} / {MAX_AVAILABLE} runs left',
        freeTierRunsExhausted: 'No runs left'
      }
    }
  }
})

describe('FreeTierQuota', () => {
  it('hides the displayed quota when the user leaves the free tier', async () => {
    render(FreeTierQuota, { global: { plugins: [i18n] } })

    expect(screen.getByTestId('free-tier-quota')).toBeInTheDocument()

    mockIsFreeTier.value = false
    await nextTick()

    expect(screen.queryByTestId('free-tier-quota')).not.toBeInTheDocument()
  })
})
