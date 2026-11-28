import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import FreeTierQuota from './FreeTierQuota.vue'

const mockIsFreeTier = ref(true)

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useSubscriptionPaywall'))

function serveFreeTierBalance(remaining: number) {
  useRemoteConfigStore().acceptConfig(
    { free_tier_balance: { allowance: 5, remaining, used: 5 - remaining } },
    false
  )
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      actionbar: {
        freeTierRuns: '{available} / {MAX_AVAILABLE} runs left'
      }
    }
  }
})

describe('FreeTierQuota', () => {
  beforeEach(() => {
    const billing = useBillingContext()
    billing.isFreeTier = computed(() => mockIsFreeTier.value)
    vi.mocked(useBillingContext).mockReturnValue(billing)

    mockIsFreeTier.value = true
    serveFreeTierBalance(3)
  })

  it('hides the displayed quota when the user leaves the free tier', async () => {
    render(FreeTierQuota, { global: { plugins: [i18n] } })

    expect(screen.getByTestId('free-tier-quota')).toBeInTheDocument()

    mockIsFreeTier.value = false
    await nextTick()

    expect(screen.queryByTestId('free-tier-quota')).not.toBeInTheDocument()
  })

  it('shows an explicit zero count when the quota is exhausted', async () => {
    serveFreeTierBalance(0)
    render(FreeTierQuota, { global: { plugins: [i18n] } })

    expect(await screen.findByText('0 / 5 runs left')).toBeInTheDocument()
  })
})
