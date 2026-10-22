import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import { runDeniedPaymentPastDueFact } from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('@/platform/billing/composables/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

import { useBillingBanner as createBillingBanner } from './useBillingBanner'

describe('useBillingBanner', () => {
  let scope: EffectScope

  function useBillingBanner() {
    const banner = scope.run(createBillingBanner)
    if (!banner) throw new Error('Failed to create billing banner')
    return banner
  }

  function setupBilling() {
    const billing = {
      canAccessSubscriptionFeatures: ref(true),
      isTeamPlan: ref(true),
      billingStatus: ref<BillingStatus | null>('paid'),
      tier: ref<SubscriptionInfo['tier']>(null),
      subscription: ref<Pick<SubscriptionInfo, 'hasFunds'> | null>({
        hasFunds: true
      })
    }
    const billingContext = useBillingContext()
    billingContext.canAccessSubscriptionFeatures = computed(
      () => billing.canAccessSubscriptionFeatures.value
    )
    billingContext.isTeamPlan = computed(() => billing.isTeamPlan.value)
    billingContext.billingStatus = computed(() => billing.billingStatus.value)
    billingContext.subscription = computed(() =>
      billing.subscription.value &&
      (billing.canAccessSubscriptionFeatures.value || billing.tier.value)
        ? {
            isActive: billing.canAccessSubscriptionFeatures.value,
            tier: billing.tier.value,
            duration: null,
            planSlug: null,
            scheduledChange: null,
            renewalDate: null,
            endDate: null,
            isCancelled: false,
            ...billing.subscription.value,
            agentHasFunds: billing.subscription.value.hasFunds
          }
        : null
    )
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    return billing
  }

  beforeEach(() => {
    distribution.isCloud = true
    const workspaceUI = vi.mocked(useWorkspaceUI())
    const defaultPermissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...defaultPermissions,
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true
    }))
    vi.mocked(useFeatureFlags().flags).billingControlEnabled = true
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = true
    scope = effectScope()
  })

  afterEach(() => scope.stop())

  it('suppresses the banner entirely when billing control is rolled back', async () => {
    vi.mocked(useFeatureFlags().flags).billingControlEnabled = true

    const billing = setupBilling()
    const { kind } = useBillingBanner()

    billing.subscription.value = { hasFunds: false }
    await nextTick()
    expect(kind.value).toBe('outOfCredits')

    vi.mocked(useFeatureFlags().flags).billingControlEnabled = false
    await nextTick()
    expect(kind.value).toBeNull()
  })

  it('stays quiet off cloud, including when unified billing settings is on', async () => {
    distribution.isCloud = false
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    const billing = setupBilling()
    const { kind } = useBillingBanner()

    billing.tier.value = 'PRO'
    billing.billingStatus.value = 'paused'
    billing.subscription.value = { hasFunds: false }
    await nextTick()

    expect(kind.value).toBeNull()
  })

  it('re-shows the out-of-credits banner after a top-up and a later exhaustion', async () => {
    const billing = setupBilling()
    const { kind, dismiss } = useBillingBanner()

    billing.subscription.value = { hasFunds: false }
    await nextTick()
    expect(kind.value).toBe('outOfCredits')

    dismiss()
    await nextTick()
    expect(kind.value).toBeNull()

    billing.subscription.value = { hasFunds: true }
    await nextTick()
    billing.subscription.value = { hasFunds: false }
    await nextTick()
    expect(kind.value).toBe('outOfCredits')
  })

  it.for<{
    status: BillingStatus
    canAccess: boolean
    kind: 'paused' | null
  }>([
    { status: 'paused', canAccess: false, kind: 'paused' },
    { status: 'paused', canAccess: true, kind: 'paused' },
    { status: 'payment_failed', canAccess: false, kind: null },
    { status: 'payment_failed', canAccess: true, kind: null }
  ])(
    'reads the $status billing status with access $canAccess as $kind',
    async ({ status, canAccess, kind: expected }) => {
      const billing = setupBilling()
      const { kind } = useBillingBanner()

      billing.tier.value = 'PRO'
      billing.billingStatus.value = status
      billing.canAccessSubscriptionFeatures.value = canAccess
      await nextTick()

      expect(kind.value).toBe(expected)
    }
  )

  it('keeps the out-of-credits banner when run is denied for a past-due payment and access is locked', async () => {
    const billing = setupBilling()
    useBillingCapabilities().runDeniedPaymentPastDue =
      runDeniedPaymentPastDueFact(true)
    const { kind } = useBillingBanner()

    billing.tier.value = 'PRO'
    billing.subscription.value = { hasFunds: false }
    billing.canAccessSubscriptionFeatures.value = false
    await nextTick()

    expect(kind.value).toBe('outOfCredits')
  })
})
