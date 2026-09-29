import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { SubscriptionInfo } from '@/composables/billing/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

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
      billing.subscription.value
        ? {
            isActive: true,
            tier: null,
            duration: null,
            planSlug: null,
            scheduledChange: null,
            renewalDate: null,
            endDate: null,
            isCancelled: false,
            ...billing.subscription.value
          }
        : null
    )
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    return billing
  }

  beforeEach(() => {
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

  it('refreshes status and balance on focus while payment recovery is visible', async () => {
    const billing = setupBilling()
    useBillingBanner()
    billing.billingStatus.value = 'payment_failed'

    window.dispatchEvent(new Event('focus'))
    await nextTick()

    expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
  })

  it('does not refresh payment recovery on focus when the flag is off', async () => {
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = true

    const billing = setupBilling()
    useBillingBanner()
    billing.billingStatus.value = 'payment_failed'
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = false

    window.dispatchEvent(new Event('focus'))
    await nextTick()

    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
    expect(useBillingContext().fetchBalance).not.toHaveBeenCalled()
  })
})
