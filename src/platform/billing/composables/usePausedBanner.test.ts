import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'

import { pausedBannerCopy, usePausedBanner } from './usePausedBanner'

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

describe('usePausedBanner', () => {
  let scope: EffectScope | undefined

  afterEach(() => {
    scope?.stop()
    distribution.isCloud = true
  })

  function arrange(billingStatus: BillingStatus) {
    const billingContext = useBillingContext()
    billingContext.billingStatus = computed(() => billingStatus)
    billingContext.canAccessSubscriptionFeatures = computed(
      () => billingStatus === 'paid'
    )
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    scope = effectScope()
    const banner = scope.run(usePausedBanner)
    if (!banner) throw new Error('Failed to create the paused banner')
    return banner
  }

  it.for<{ status: BillingStatus; isCloud: boolean; isPaused: boolean }>([
    { status: 'paused', isCloud: true, isPaused: true },
    { status: 'paused', isCloud: false, isPaused: false },
    { status: 'payment_failed', isCloud: true, isPaused: false },
    { status: 'paid', isCloud: true, isPaused: false }
  ])(
    'reads billing status $status on Cloud $isCloud as paused $isPaused',
    ({ status, isCloud, isPaused }) => {
      distribution.isCloud = isCloud

      expect(arrange(status).isPaused.value).toBe(isPaused)
    }
  )

  it.for([
    {
      canManageBilling: true,
      bodyKey: 'workspacePanel.billingStatus.paused.body',
      action: 'updatePayment'
    },
    {
      canManageBilling: false,
      bodyKey: 'subscription.paymentRecovery.memberDescription',
      action: null
    }
  ])(
    'gives billing management $canManageBilling the $bodyKey copy',
    ({ canManageBilling, bodyKey, action }) => {
      expect(pausedBannerCopy(canManageBilling)).toMatchObject({
        titleKey: 'subscription.paymentRecovery.title',
        bodyKey,
        action
      })
    }
  )
})
