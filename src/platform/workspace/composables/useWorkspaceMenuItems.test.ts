import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceMenuItems } from './useWorkspaceMenuItems'

const state = vi.hoisted(() => ({
  canLeaveWorkspace: false,
  canManageSubscription: false,
  canManageSubscriptionLifecycle: false,
  isActiveSubscription: true,
  isDeleteDisabled: false,
  isFreeTier: false,
  isInPersonalWorkspace: false,
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
    vi.clearAllMocks()
    state.canLeaveWorkspace = false
    state.canManageSubscription = false
    state.canManageSubscriptionLifecycle = false
    state.isActiveSubscription = true
    state.isDeleteDisabled = false
    state.isFreeTier = false
    state.isInPersonalWorkspace = false
    state.isSubscriptionCancelled = false
  })

  it.for([
    { workspaceType: 'Personal', isInPersonalWorkspace: true },
    { workspaceType: 'Team', isInPersonalWorkspace: false }
  ])(
    'uses the shared cancellation dialog for an active $workspaceType workspace plan',
    ({ isInPersonalWorkspace }) => {
      state.canManageSubscriptionLifecycle = true
      state.isInPersonalWorkspace = isInPersonalWorkspace

      const { menuItems } = useWorkspaceMenuItems()
      const cancelItem = menuItems.value.find(
        (item) => item.label === 'subscription.cancelPlan'
      )
      cancelItem?.command?.({
        originalEvent: new Event('click'),
        item: cancelItem
      })

      expect(cancelItem).toBeDefined()
      expect(dialogMocks.showCancelSubscriptionDialog).toHaveBeenCalledWith(
        '2026-08-01T00:00:00Z'
      )
    }
  )

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
