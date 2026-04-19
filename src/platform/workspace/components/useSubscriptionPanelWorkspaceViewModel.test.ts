import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useSubscriptionPanelWorkspaceViewModel } from './useSubscriptionPanelWorkspaceViewModel'

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: { value: { free_tier_credits: 100 } }
}))

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key

const n = (value: number) => String(value)

function makeVm(overrides: Record<string, unknown> = {}) {
  const showSubscriptionDialog = vi.fn()
  const showPricingTable = vi.fn()
  const showCancelSubscriptionDialog = vi.fn()

  const defaults = {
    isActiveSubscription: ref(false),
    isFreeTierPlan: ref(false),
    subscription: ref(null),
    isWorkspaceSubscribed: ref(true),
    isInPersonalWorkspace: ref(false),
    members: ref([{ id: '1' }, { id: '2' }]),
    permissions: ref({ canManageSubscription: true, canTopUp: true }),
    monthlyBonusCredits: ref('50'),
    t,
    n,
    getMaxSeats: () => 5,
    showSubscriptionDialog,
    showPricingTable,
    showCancelSubscriptionDialog,
    ...overrides
  }

  const vm = useSubscriptionPanelWorkspaceViewModel(defaults as never)
  return { vm, showSubscriptionDialog, showPricingTable }
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    tier: 'STANDARD',
    duration: 'MONTHLY',
    renewalDate: '2026-06-15T12:00:00Z',
    endDate: null,
    isCancelled: false,
    ...overrides
  }
}

describe('useSubscriptionPanelWorkspaceViewModel', () => {
  describe('showSubscribePrompt', () => {
    it('true for unsubscribed owner in team workspace', () => {
      const { vm } = makeVm({
        isWorkspaceSubscribed: ref(false),
        isActiveSubscription: ref(false)
      })
      expect(vm.showSubscribePrompt.value).toBe(true)
    })

    it('false for owner with active subscription', () => {
      const { vm } = makeVm({
        isActiveSubscription: ref(true),
        subscription: ref(makeSubscription())
      })
      expect(vm.showSubscribePrompt.value).toBe(false)
    })

    it('false when member cannot manage subscription', () => {
      const { vm } = makeVm({
        permissions: ref({ canManageSubscription: false, canTopUp: false }),
        isWorkspaceSubscribed: ref(false)
      })
      expect(vm.showSubscribePrompt.value).toBe(false)
    })

    it('true for personal workspace without active subscription', () => {
      const { vm } = makeVm({
        isInPersonalWorkspace: ref(true),
        isActiveSubscription: ref(false)
      })
      expect(vm.showSubscribePrompt.value).toBe(true)
    })

    it('false when subscription is cancelled (still active until end date)', () => {
      const { vm } = makeVm({
        isWorkspaceSubscribed: ref(true),
        isActiveSubscription: ref(true),
        subscription: ref(makeSubscription({ isCancelled: true }))
      })
      expect(vm.showSubscribePrompt.value).toBe(false)
    })
  })

  describe('isMemberView', () => {
    it('true for non-managing member in unsubscribed workspace', () => {
      const { vm } = makeVm({
        permissions: ref({ canManageSubscription: false, canTopUp: false }),
        isWorkspaceSubscribed: ref(false),
        isActiveSubscription: ref(false)
      })
      expect(vm.isMemberView.value).toBe(true)
    })

    it('false when member has manage permission', () => {
      const { vm } = makeVm({
        isWorkspaceSubscribed: ref(false),
        isActiveSubscription: ref(false)
      })
      expect(vm.isMemberView.value).toBe(false)
    })
  })

  describe('showZeroState', () => {
    it('true when subscribe prompt is shown', () => {
      const { vm } = makeVm({
        isWorkspaceSubscribed: ref(false),
        isActiveSubscription: ref(false)
      })
      expect(vm.showZeroState.value).toBe(true)
    })

    it('true when member view is shown', () => {
      const { vm } = makeVm({
        permissions: ref({ canManageSubscription: false, canTopUp: false }),
        isWorkspaceSubscribed: ref(false),
        isActiveSubscription: ref(false)
      })
      expect(vm.showZeroState.value).toBe(true)
    })

    it('false for active subscription', () => {
      const { vm } = makeVm({
        isActiveSubscription: ref(true),
        subscription: ref(makeSubscription())
      })
      expect(vm.showZeroState.value).toBe(false)
    })
  })

  describe('isCancelled', () => {
    it('true for cancelled team workspace subscription', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription({ isCancelled: true }))
      })
      expect(vm.isCancelled.value).toBe(true)
    })

    it('false for personal workspace even if isCancelled', () => {
      const { vm } = makeVm({
        isInPersonalWorkspace: ref(true),
        subscription: ref(makeSubscription({ isCancelled: true }))
      })
      expect(vm.isCancelled.value).toBe(false)
    })

    it('false when subscription is null', () => {
      const { vm } = makeVm()
      expect(vm.isCancelled.value).toBe(false)
    })
  })

  describe('tier and pricing', () => {
    it('derives tier key and monthly price for standard', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription())
      })
      expect(vm.tierKey.value).toBe('standard')
      expect(vm.tierPrice.value).toBe(20)
    })

    it('derives yearly price for annual subscription', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription({ duration: 'ANNUAL' }))
      })
      expect(vm.isYearlySubscription.value).toBe(true)
      expect(vm.tierPrice.value).toBe(16)
    })

    it('derives creator tier pricing', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription({ tier: 'CREATOR' }))
      })
      expect(vm.tierKey.value).toBe('creator')
      expect(vm.tierPrice.value).toBe(35)
    })
  })

  describe('subscriptionTierName', () => {
    it('returns translated tier name for monthly', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription())
      })
      expect(vm.subscriptionTierName.value).toBe(
        'subscription.tiers.standard.name'
      )
    })

    it('returns yearly-wrapped tier name for annual', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription({ duration: 'ANNUAL' }))
      })
      expect(vm.subscriptionTierName.value).toContain(
        'subscription.tierNameYearly'
      )
    })

    it('returns empty string when no subscription', () => {
      const { vm } = makeVm()
      expect(vm.subscriptionTierName.value).toBe('')
    })
  })

  describe('date formatting', () => {
    it('formats renewal date', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription())
      })
      expect(vm.formattedRenewalDate.value).toContain('Jun')
      expect(vm.formattedRenewalDate.value).toContain('2026')
    })

    it('formats end date', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription({ endDate: '2026-07-15T00:00:00Z' }))
      })
      expect(vm.formattedEndDate.value).toContain('Jul')
      expect(vm.formattedEndDate.value).toContain('2026')
    })

    it('returns empty string for missing dates', () => {
      const { vm } = makeVm()
      expect(vm.formattedRenewalDate.value).toBe('')
      expect(vm.formattedEndDate.value).toBe('')
    })
  })

  describe('invoice computation', () => {
    it('computes invoice from members × tier price', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription()),
        members: ref([{ id: '1' }, { id: '2' }])
      })
      expect(vm.memberCount.value).toBe(2)
      expect(vm.nextMonthInvoice.value).toBe(40)
    })

    it('scales with member count', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription()),
        members: ref([{ id: '1' }, { id: '2' }, { id: '3' }])
      })
      expect(vm.nextMonthInvoice.value).toBe(60)
    })
  })

  describe('credits display', () => {
    it('shows included credits with plan total', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription()),
        monthlyBonusCredits: ref('2,100')
      })
      expect(vm.includedCreditsDisplay.value).toBe('2,100 / 4200')
    })

    it('uses monthly label for monthly subscription', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription())
      })
      expect(vm.creditsRemainingLabel.value).toContain(
        'subscription.creditsRemainingThisMonth'
      )
    })

    it('uses yearly label for annual subscription', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription({ duration: 'ANNUAL' }))
      })
      expect(vm.creditsRemainingLabel.value).toContain(
        'subscription.creditsRemainingThisYear'
      )
    })
  })

  describe('tier benefits', () => {
    it('includes members benefit for team workspaces', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription()),
        isInPersonalWorkspace: ref(false)
      })
      const members = vm.tierBenefits.value.find((b) => b.key === 'members')
      expect(members).toBeDefined()
      expect(members?.type).toBe('icon')
    })

    it('excludes members benefit for personal workspaces', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription()),
        isInPersonalWorkspace: ref(true)
      })
      const members = vm.tierBenefits.value.find((b) => b.key === 'members')
      expect(members).toBeUndefined()
    })
  })

  describe('action handlers', () => {
    it('handleSubscribeWorkspace calls showSubscriptionDialog', () => {
      const { vm, showSubscriptionDialog } = makeVm()
      vm.handleSubscribeWorkspace()
      expect(showSubscriptionDialog).toHaveBeenCalled()
    })

    it('handleUpgrade calls showPricingTable for free tier', () => {
      const { vm, showPricingTable } = makeVm({
        isFreeTierPlan: ref(true)
      })
      vm.handleUpgrade()
      expect(showPricingTable).toHaveBeenCalled()
    })

    it('handleUpgrade calls showSubscriptionDialog for paid tier', () => {
      const { vm, showSubscriptionDialog } = makeVm({
        isFreeTierPlan: ref(false)
      })
      vm.handleUpgrade()
      expect(showSubscriptionDialog).toHaveBeenCalled()
    })

    it('handleUpgradeToAddCredits calls showPricingTable', () => {
      const { vm, showPricingTable } = makeVm()
      vm.handleUpgradeToAddCredits()
      expect(showPricingTable).toHaveBeenCalled()
    })
  })

  describe('planMenuItems', () => {
    it('has cancel subscription item', () => {
      const { vm } = makeVm({
        subscription: ref(makeSubscription())
      })
      expect(vm.planMenuItems.value).toHaveLength(1)
      expect(vm.planMenuItems.value[0].label).toContain(
        'subscription.cancelSubscription'
      )
    })
  })

  describe('reactivity', () => {
    it('recomputes when subscription changes', () => {
      const subscription = ref(makeSubscription())
      const { vm } = makeVm({ subscription })

      expect(vm.tierPrice.value).toBe(20)

      subscription.value = makeSubscription({ tier: 'PRO' })
      expect(vm.tierPrice.value).toBe(100)
    })

    it('recomputes showSubscribePrompt when workspace subscription changes', () => {
      const isWorkspaceSubscribed = ref(true)
      const { vm } = makeVm({ isWorkspaceSubscribed })

      expect(vm.showSubscribePrompt.value).toBe(false)

      isWorkspaceSubscribed.value = false
      expect(vm.showSubscribePrompt.value).toBe(true)
    })
  })
})
