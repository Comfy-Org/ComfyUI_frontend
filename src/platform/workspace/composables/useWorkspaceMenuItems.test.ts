import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceMenuItems } from './useWorkspaceMenuItems'

const state = vi.hoisted(() => ({
  canLeaveWorkspace: false,
  canManageSubscriptionLifecycle: false,
  isActiveSubscription: true,
  isFreeTier: false,
  isInPersonalWorkspace: false,
  isOriginalOwner: false,
  isSubscriptionCancelled: false
}))

const dialogMocks = vi.hoisted(() => ({
  showCancelSubscriptionDialog: vi.fn(),
  showEditWorkspaceDialog: vi.fn(),
  showDeleteWorkspaceDialog: vi.fn(),
  showLeaveWorkspaceDialog: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isFreeTier: computed(() => state.isFreeTier),
    subscription: computed(() => ({ endDate: '2026-08-01T00:00:00Z' }))
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: {
      get value() {
        return {
          canLeaveWorkspace: state.canLeaveWorkspace,
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
    isOriginalOwner: computed(() => state.isOriginalOwner),
    isSubscriptionCancelled: computed(() => state.isSubscriptionCancelled),
    isDeleteDisabled: computed(() => false),
    deleteDisabledTooltipKey: computed(() => null)
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => dialogMocks
}))

describe('useWorkspaceMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.canLeaveWorkspace = false
    state.canManageSubscriptionLifecycle = false
    state.isActiveSubscription = true
    state.isFreeTier = false
    state.isInPersonalWorkspace = false
    state.isOriginalOwner = false
    state.isSubscriptionCancelled = false
  })

  it('allows a promoted owner to cancel an active plan', () => {
    state.canManageSubscriptionLifecycle = true

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toContain(
      'subscription.cancelPlan'
    )
  })

  it('withholds cancellation from a member', () => {
    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'subscription.cancelPlan'
    )
  })

  it('withholds cancellation for an already-cancelled plan', () => {
    state.canManageSubscriptionLifecycle = true
    state.isSubscriptionCancelled = true

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'subscription.cancelPlan'
    )
  })

  it('rechecks eligibility before opening the cancellation dialog', () => {
    state.canManageSubscriptionLifecycle = true
    const { menuItems } = useWorkspaceMenuItems()
    const cancelItem = menuItems.value.find(
      (item) => item.label === 'subscription.cancelPlan'
    )

    state.canManageSubscriptionLifecycle = false
    cancelItem?.command?.({
      originalEvent: new Event('click'),
      item: cancelItem
    })

    expect(dialogMocks.showCancelSubscriptionDialog).not.toHaveBeenCalled()
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
})
