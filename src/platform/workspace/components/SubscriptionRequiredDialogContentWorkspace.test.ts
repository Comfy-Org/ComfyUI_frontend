import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

import type {
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'

import SubscriptionRequiredDialogContentWorkspace from './SubscriptionRequiredDialogContentWorkspace.vue'

const mockToastAdd = vi.fn<(message: unknown) => void>()
const mockSubscribe = vi.fn<() => Promise<SubscribeResponse | undefined>>()
const mockPreviewSubscribe =
  vi.fn<() => Promise<PreviewSubscribeResponse | null | undefined>>()
const mockFetchStatus = vi.fn<() => Promise<void>>()
const mockFetchBalance = vi.fn<() => Promise<void>>()
const mockTrackMonthlySubscriptionSucceeded = vi.fn<() => void>()
const mockStartOperation =
  vi.fn<(opId: string, type: 'subscription' | 'topup') => void>()
const mockPlans = ref([
  {
    slug: 'creator-monthly',
    tier: 'CREATOR',
    duration: 'MONTHLY',
    price_cents: 4900,
    credits_cents: 1000,
    max_seats: 5,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 4900,
      total_credits_cents: 1000
    }
  }
])

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    previewSubscribe: mockPreviewSubscribe,
    plans: mockPlans,
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackMonthlySubscriptionSucceeded: mockTrackMonthlySubscriptionSucceeded
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    hasPendingOperations: false,
    startOperation: mockStartOperation
  })
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.test'
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    resubscribe: vi.fn<() => Promise<void>>()
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function buildPreviewResponse(
  transitionType: PreviewSubscribeResponse['transition_type']
): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: transitionType,
    effective_at: '2026-04-10T00:00:00.000Z',
    is_immediate: transitionType !== 'new_subscription',
    cost_today_cents: 4900,
    cost_next_period_cents: 4900,
    credits_today_cents: 1000,
    credits_next_period_cents: 1000,
    current_plan:
      transitionType === 'new_subscription'
        ? undefined
        : {
            slug: 'standard-monthly',
            tier: 'STANDARD',
            duration: 'MONTHLY',
            price_cents: 2900,
            credits_cents: 500,
            seat_summary: {
              seat_count: 1,
              total_cost_cents: 2900,
              total_credits_cents: 500
            },
            period_start: '2026-04-01T00:00:00.000Z',
            period_end: '2026-05-01T00:00:00.000Z'
          },
    new_plan: {
      slug: 'creator-monthly',
      tier: 'CREATOR',
      duration: 'MONTHLY',
      price_cents: 4900,
      credits_cents: 1000,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 4900,
        total_credits_cents: 1000
      },
      period_start: '2026-04-10T00:00:00.000Z',
      period_end: '2026-05-10T00:00:00.000Z'
    }
  }
}

function mountComponent() {
  return shallowMount(SubscriptionRequiredDialogContentWorkspace, {
    props: {
      onClose: vi.fn<() => void>()
    },
    global: {
      plugins: [i18n]
    }
  })
}

async function goToPreview(
  transitionType: PreviewSubscribeResponse['transition_type']
) {
  mockPreviewSubscribe.mockResolvedValueOnce(
    buildPreviewResponse(transitionType)
  )

  const wrapper = mountComponent()
  wrapper
    .getComponent({ name: 'PricingTableWorkspace' })
    .vm.$emit('subscribe', {
      tierKey: 'creator',
      billingCycle: 'monthly'
    })
  await flushPromises()

  return wrapper
}

describe('SubscriptionRequiredDialogContentWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fires subscription success telemetry on immediate new subscription success', async () => {
    mockSubscribe.mockResolvedValueOnce({
      billing_op_id: 'billing-op-1',
      status: 'subscribed'
    })

    const wrapper = await goToPreview('new_subscription')
    wrapper
      .getComponent({ name: 'SubscriptionAddPaymentPreviewWorkspace' })
      .vm.$emit('add-credit-card')
    await flushPromises()

    expect(mockTrackMonthlySubscriptionSucceeded).toHaveBeenCalledOnce()
    expect(mockFetchStatus).toHaveBeenCalledOnce()
    expect(mockFetchBalance).toHaveBeenCalledOnce()
    expect(mockStartOperation).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toEqual([[true]])
  })

  it('fires subscription success telemetry on immediate transition success', async () => {
    mockSubscribe.mockResolvedValueOnce({
      billing_op_id: 'billing-op-2',
      status: 'subscribed'
    })

    const wrapper = await goToPreview('upgrade')
    wrapper
      .getComponent({ name: 'SubscriptionTransitionPreviewWorkspace' })
      .vm.$emit('confirm')
    await flushPromises()

    expect(mockTrackMonthlySubscriptionSucceeded).toHaveBeenCalledOnce()
    expect(mockFetchStatus).toHaveBeenCalledOnce()
    expect(mockFetchBalance).toHaveBeenCalledOnce()
    expect(mockStartOperation).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toEqual([[true]])
  })
})
