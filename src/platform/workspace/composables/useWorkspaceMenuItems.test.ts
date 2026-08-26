import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceMenuItems } from './useWorkspaceMenuItems'

const state = vi.hoisted(() => ({
  billingStatus: 'paid',
  canCancel: false,
  canLeaveWorkspace: false,
  canManageSubscription: false,
  canManageSubscriptionLifecycle: false,
  isActiveSubscription: true,
  isDeleteDisabled: false,
  isFreeTier: false,
  isInPersonalWorkspace: false,
  planSlug: 'pro-monthly' as string | null,
  shouldUseWorkspaceBilling: true,
  isSubscriptionCancelled: false
}))

const dialogMocks = vi.hoisted(() => ({
  showCancelSubscriptionFlow: vi.fn(),
  showEditWorkspaceDialog: vi.fn(),
  showDeleteWorkspaceDialog: vi.fn(),
  showLeaveWorkspaceDialog: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    billingStatus: computed(() => state.billingStatus),
    isFreeTier: computed(() => state.isFreeTier),
    subscription: computed(() => ({
      endDate: '2026-08-01T00:00:00Z',
      planSlug: state.planSlug
    }))
  })
}))

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: computed(() => state.shouldUseWorkspaceBilling)
  })
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canCancel: {
      get value() {
        return state.canCancel
      }
    }
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: {
      get value() {
        return {
          canLeaveWorkspace: state.canLeaveWorkspace,
          canManageSubscription: state.canManageSubscription,
          canManageSubscriptionLifecycle: state.canManageSubscriptionLifecycle
        }
      }
    },
    uiConfig: computed(() => ({
      showEditWorkspaceMenuItem: false,
      workspaceMenuAction: null,
      workspaceMenuDisabledTooltip: null
    })),
    isInPersonalWorkspace: computed(() => state.isInPersonalWorkspace),
    isActiveSubscription: computed(() => state.isActiveSubscription),
    isSubscriptionCancelled: computed(() => state.isSubscriptionCancelled),
    isDeleteDisabled: {
      get value() {
        return state.isDeleteDisabled
      }
    },
    deleteDisabledTooltipKey: computed(() => null)
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => dialogMocks
}))

describe('useWorkspaceMenuItems', () => {
  beforeEach(() => {
    state.billingStatus = 'paid'
    state.canCancel = false
    state.canLeaveWorkspace = false
    state.canManageSubscription = false
    state.canManageSubscriptionLifecycle = false
    state.isActiveSubscription = true
    state.isDeleteDisabled = false
    state.isFreeTier = false
    state.isInPersonalWorkspace = false
    state.planSlug = 'pro-monthly'
    state.shouldUseWorkspaceBilling = true
    state.isSubscriptionCancelled = false
  })

  it('allows a promoted owner to cancel an active plan', () => {
    state.canCancel = true

    const { menuItems } = useWorkspaceMenuItems()
    const cancelItem = menuItems.value.find(
      (item) => item.label === 'subscription.cancelPlan'
    )

    cancelItem?.command?.({
      originalEvent: new Event('click'),
      item: cancelItem
    })

    expect(dialogMocks.showCancelSubscriptionFlow).toHaveBeenCalledWith(
      '2026-08-01T00:00:00Z'
    )
  })

  it('withholds cancellation from a member', () => {
    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'subscription.cancelPlan'
    )
  })

  it('withholds cancellation for a free plan the capability still allows', () => {
    state.canCancel = true
    state.isFreeTier = true

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'subscription.cancelPlan'
    )
  })

  it('defers to the capability for subscription state it already encodes', () => {
    state.canCancel = true
    state.isSubscriptionCancelled = true
    state.isActiveSubscription = false
    state.planSlug = null

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toContain(
      'subscription.cancelPlan'
    )
  })

  it('withholds cancellation for an already-cancelled plan', () => {
    state.shouldUseWorkspaceBilling = false
    state.canManageSubscriptionLifecycle = true
    state.isSubscriptionCancelled = true

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'subscription.cancelPlan'
    )
  })

  it('allows cancellation while a payment_failed plan needs payment recovery', () => {
    state.shouldUseWorkspaceBilling = false
    state.billingStatus = 'payment_failed'
    state.canManageSubscriptionLifecycle = true
    state.isActiveSubscription = false

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toContain(
      'subscription.cancelPlan'
    )
  })

  it('allows cancellation while an existing plan is paused', () => {
    state.shouldUseWorkspaceBilling = false
    state.billingStatus = 'paused'
    state.canManageSubscriptionLifecycle = true
    state.isActiveSubscription = false

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toContain(
      'subscription.cancelPlan'
    )
  })

  it('withholds cancellation when payment_failed has no subscription plan', () => {
    state.shouldUseWorkspaceBilling = false
    state.billingStatus = 'payment_failed'
    state.canManageSubscriptionLifecycle = true
    state.isActiveSubscription = false
    state.planSlug = null

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'subscription.cancelPlan'
    )
  })

  it('withholds cancellation for payment_failed without lifecycle permission', () => {
    state.shouldUseWorkspaceBilling = false
    state.billingStatus = 'payment_failed'
    state.canManageSubscriptionLifecycle = false
    state.isActiveSubscription = false

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'subscription.cancelPlan'
    )
  })

  it('withholds cancellation for a free plan on the legacy path', () => {
    state.shouldUseWorkspaceBilling = false
    state.canManageSubscriptionLifecycle = true
    state.isFreeTier = true

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'subscription.cancelPlan'
    )
  })

  it('rechecks eligibility before opening the cancellation dialog', () => {
    state.canCancel = true
    const { menuItems } = useWorkspaceMenuItems()
    const cancelItem = menuItems.value.find(
      (item) => item.label === 'subscription.cancelPlan'
    )

    state.canCancel = false
    cancelItem?.command?.({
      originalEvent: new Event('click'),
      item: cancelItem
    })

    expect(dialogMocks.showCancelSubscriptionFlow).not.toHaveBeenCalled()
  })

  it('shows Leave only when workspace permission grants it', () => {
    const hiddenItems = useWorkspaceMenuItems().menuItems

    expect(hiddenItems.value.map((item) => item.label)).not.toContain(
      'workspacePanel.menu.leaveWorkspace'
    )

    state.canLeaveWorkspace = true
    const visibleItems = useWorkspaceMenuItems().menuItems

    expect(visibleItems.value.map((item) => item.label)).toContain(
      'workspacePanel.menu.leaveWorkspace'
    )
  })

  it('rechecks permission before opening the Leave dialog', () => {
    state.canLeaveWorkspace = true
    const { menuItems } = useWorkspaceMenuItems()
    const leaveItem = menuItems.value.find(
      (item) => item.label === 'workspacePanel.menu.leaveWorkspace'
    )

    state.canLeaveWorkspace = false
    leaveItem?.command?.({
      originalEvent: new Event('click'),
      item: leaveItem
    })

    expect(dialogMocks.showLeaveWorkspaceDialog).not.toHaveBeenCalled()
  })

  it('shows Leave and Delete when owner permissions grant both', () => {
    state.canLeaveWorkspace = true
    state.canManageSubscription = true

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toEqual([
      'workspacePanel.menu.deleteWorkspace',
      'workspacePanel.menu.leaveWorkspace'
    ])
  })

  it('withholds Delete from members', () => {
    state.canLeaveWorkspace = true

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toEqual([
      'workspacePanel.menu.leaveWorkspace'
    ])
  })

  it('withholds Delete from personal workspace owners', () => {
    state.canManageSubscription = true
    state.isInPersonalWorkspace = true

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'workspacePanel.menu.deleteWorkspace'
    )
  })

  it('disables Delete while the additional workspace is subscribed', () => {
    state.canManageSubscription = true
    state.isDeleteDisabled = true

    const { menuItems } = useWorkspaceMenuItems()
    const deleteItem = menuItems.value.find(
      (item) => item.label === 'workspacePanel.menu.deleteWorkspace'
    )

    expect(deleteItem).toMatchObject({ disabled: true, command: undefined })
  })

  it('rechecks owner permission before opening the Delete dialog', () => {
    state.canManageSubscription = true
    const { menuItems } = useWorkspaceMenuItems()
    const deleteItem = menuItems.value.find(
      (item) => item.label === 'workspacePanel.menu.deleteWorkspace'
    )

    state.canManageSubscription = false
    deleteItem?.command?.({
      originalEvent: new Event('click'),
      item: deleteItem
    })

    expect(dialogMocks.showDeleteWorkspaceDialog).not.toHaveBeenCalled()
  })

  it('rechecks the subscription lock before opening the Delete dialog', () => {
    state.canManageSubscription = true
    const { menuItems } = useWorkspaceMenuItems()
    const deleteItem = menuItems.value.find(
      (item) => item.label === 'workspacePanel.menu.deleteWorkspace'
    )

    state.isDeleteDisabled = true
    deleteItem?.command?.({
      originalEvent: new Event('click'),
      item: deleteItem
    })

    expect(dialogMocks.showDeleteWorkspaceDialog).not.toHaveBeenCalled()
  })
})
