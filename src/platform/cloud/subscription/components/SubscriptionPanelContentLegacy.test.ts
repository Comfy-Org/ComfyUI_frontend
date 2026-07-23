import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscriptionPanelContentLegacy from './SubscriptionPanelContentLegacy.vue'

const mockAccessBillingPortal = vi.fn()
const mockTrackSubscriptionCancellation = vi.fn()
const mockShowSubscriptionDialog = vi.fn()
const mockHandleRefresh = vi.fn()

const mockIsActiveSubscription = ref(true)
const mockIsCancelled = ref(false)
const mockIsFreeTier = ref(false)
const mockSubscriptionTier = ref<'STANDARD' | 'CREATOR' | 'PRO' | null>(
  'STANDARD'
)
const mockIsYearlySubscription = ref(true)

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    accessBillingPortal: mockAccessBillingPortal
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackSubscriptionCancellation: mockTrackSubscriptionCancellation
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    canAccessSubscriptionFeatures: computed(() => mockIsActiveSubscription.value),
    isCancelled: computed(() => mockIsCancelled.value),
    isFreeTier: computed(() => mockIsFreeTier.value),
    formattedRenewalDate: computed(() => '2026-08-01'),
    formattedEndDate: computed(() => '2026-08-01'),
    subscriptionTier: computed(() => mockSubscriptionTier.value),
    subscriptionTierName: computed(() => 'Standard'),
    isYearlySubscription: computed(() => mockIsYearlySubscription.value)
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionActions',
  () => ({
    useSubscriptionActions: () => ({
      handleRefresh: mockHandleRefresh
    })
  })
)

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({
      show: mockShowSubscriptionDialog
    })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        perMonth: '/ month',
        manageSubscription: 'Manage subscription',
        upgradePlan: 'Upgrade plan',
        subscribeNow: 'Subscribe now',
        yourPlanIncludes: 'Your plan includes',
        viewMoreDetailsPlans: 'View more details',
        renewsDate: 'Renews {date}',
        expiresDate: 'Expires {date}',
        monthlyCreditsLabel: 'monthly credits',
        maxDurationLabel: 'max duration',
        gpuLabel: 'GPU access',
        addCreditsLabel: 'Add credits',
        customLoRAsLabel: 'Custom LoRAs',
        maxDuration: {
          standard: '30 min'
        }
      }
    }
  }
})

function renderComponent() {
  return render(SubscriptionPanelContentLegacy, {
    global: {
      plugins: [i18n],
      stubs: {
        CreditsTile: true,
        SubscribeButton: true,
        Button: {
          template: '<button @click="$emit(\'click\')"><slot /></button>',
          emits: ['click']
        }
      }
    }
  })
}

describe('SubscriptionPanelContentLegacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAccessBillingPortal.mockResolvedValue(undefined)
    mockIsActiveSubscription.value = true
    mockIsCancelled.value = false
    mockIsFreeTier.value = false
    mockSubscriptionTier.value = 'STANDARD'
    mockIsYearlySubscription.value = true
  })

  it('tracks cancel intent before opening the billing portal', async () => {
    renderComponent()

    await userEvent.click(
      screen.getByRole('button', { name: /manage subscription/i })
    )

    expect(mockTrackSubscriptionCancellation).toHaveBeenCalledExactlyOnceWith(
      'flow_opened',
      {
        source: 'manage_subscription_button',
        current_tier: 'standard',
        cycle: 'yearly'
      }
    )
    expect(mockAccessBillingPortal).toHaveBeenCalledOnce()
  })
})
