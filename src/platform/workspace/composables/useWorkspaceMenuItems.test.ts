import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { computed, createApp, defineComponent, ref } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import enMessages from '@/locales/en/main.json'

import { useWorkspaceMenuItems as createWorkspaceMenuItems } from './useWorkspaceMenuItems'

const state = vi.hoisted(() => ({
  billingStatus: 'paid',
  canManageSubscriptionLifecycle: false,
  canAccessSubscriptionFeatures: true,
  isFreeTier: false,
  planSlug: 'pro-monthly' as string | null,
  tier: null as string | null,
  shouldUseWorkspaceBilling: true,
  isSubscriptionCancelled: false
}))

vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingContext'),
  () => ({
    useBillingContext: () => ({
      billingStatus: computed(() => state.billingStatus),
      isFreeTier: computed(() => state.isFreeTier),
      subscription: computed(() => ({
        isCancelled: state.isSubscriptionCancelled,
        endDate: '2026-08-01T00:00:00Z',
        planSlug: state.planSlug,
        tier: state.tier
      }))
    })
  })
)

vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingRouting'),
  () => ({
    useBillingRouting: () => ({
      shouldUseWorkspaceBilling: computed(() => state.shouldUseWorkspaceBilling)
    })
  })
)

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

vi.mock<unknown>(
  import('@/platform/workspace/composables/useWorkspaceUI'),
  () => ({
    useWorkspaceUI: () => ({
      permissions: {
        get value() {
          return {
            canManageSubscriptionLifecycle: state.canManageSubscriptionLifecycle
          }
        }
      },
      canAccessSubscriptionFeatures: computed(
        () => state.canAccessSubscriptionFeatures
      ),
      isSubscriptionCancelled: computed(() => state.isSubscriptionCancelled)
    })
  })
)

vi.mock(import('@/services/dialogService'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceDialogs'))

const apps: App<Element>[] = []

function useWorkspaceMenuItems(
  messages = {}
): ReturnType<typeof createWorkspaceMenuItems> {
  let result: ReturnType<typeof createWorkspaceMenuItems> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = createWorkspaceMenuItems()
        return () => null
      }
    })
  )
  app.use(
    createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
  )
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!result) throw new Error('workspace menu items not initialized')
  return result
}

function grantDelete() {
  useBillingCapabilities().canDeleteWorkspace = computed(() =>
    receiveServerFact('can_delete_workspace', true)
  )
}

function denyDelete(denial: string) {
  useBillingCapabilities().deleteWorkspaceDenial = computed(() => denial)
}

function grantLeave() {
  useBillingCapabilities().canLeaveWorkspace = computed(() =>
    receiveServerFact('can_leave_workspace', true)
  )
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
})

describe('useWorkspaceMenuItems', () => {
  beforeEach(() => {
    useBillingCapabilities().canEditWorkspace = computed(() =>
      receiveServerFact('can_edit_workspace', false)
    )
    state.billingStatus = 'paid'

    state.canManageSubscriptionLifecycle = false
    state.canAccessSubscriptionFeatures = true
    state.isFreeTier = false
    state.planSlug = 'pro-monthly'
    state.tier = null
    state.shouldUseWorkspaceBilling = true
    state.isSubscriptionCancelled = false
  })

  it('allows a promoted owner to cancel an active plan', () => {
    useBillingCapabilities().canCancel = computed(() => true)

    const { menuItems } = useWorkspaceMenuItems()
    const cancelItem = menuItems.value.find(
      (item) => item.label === 'subscription.cancelPlan'
    )

    cancelItem?.command?.({
      originalEvent: new Event('click'),
      item: cancelItem
    })

    expect(useBillingDialogs().showCancelSubscriptionFlow).toHaveBeenCalledWith(
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
    useBillingCapabilities().canCancel = computed(() => true)
    state.isFreeTier = true

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).not.toContain(
      'subscription.cancelPlan'
    )
  })

  it('defers to the capability for subscription state it already encodes', () => {
    useBillingCapabilities().canCancel = computed(() => true)
    state.isSubscriptionCancelled = true
    state.canAccessSubscriptionFeatures = false
    state.planSlug = null

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toContain(
      'subscription.cancelPlan'
    )
  })

  it.for(['ENTERPRISE', 'GALACTIC'] as const)(
    'withholds cancellation from a sales-managed %s plan on the legacy rail',
    (tier) => {
      state.shouldUseWorkspaceBilling = false
      state.canManageSubscriptionLifecycle = true
      state.tier = tier

      const { menuItems } = useWorkspaceMenuItems()

      expect(menuItems.value.map((item) => item.label)).not.toContain(
        'subscription.cancelPlan'
      )
    }
  )

  it('keeps Leave when the server refuses Delete for a sales-managed plan', () => {
    grantLeave()
    denyDelete('sales_managed_plan')

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toEqual([
      'workspacePanel.menu.leaveWorkspace'
    ])
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
    state.canAccessSubscriptionFeatures = false

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toContain(
      'subscription.cancelPlan'
    )
  })

  it('allows cancellation while an existing plan is paused', () => {
    state.shouldUseWorkspaceBilling = false
    state.billingStatus = 'paused'
    state.canManageSubscriptionLifecycle = true
    state.canAccessSubscriptionFeatures = false

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toContain(
      'subscription.cancelPlan'
    )
  })

  it('withholds cancellation when payment_failed has no subscription plan', () => {
    state.shouldUseWorkspaceBilling = false
    state.billingStatus = 'payment_failed'
    state.canManageSubscriptionLifecycle = true
    state.canAccessSubscriptionFeatures = false
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
    state.canAccessSubscriptionFeatures = false

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
    const canCancel = ref(true)
    useBillingCapabilities().canCancel = computed(() => canCancel.value)

    const { menuItems } = useWorkspaceMenuItems()
    const cancelItem = menuItems.value.find(
      (item) => item.label === 'subscription.cancelPlan'
    )

    canCancel.value = false
    cancelItem?.command?.({
      originalEvent: new Event('click'),
      item: cancelItem
    })

    expect(
      useBillingDialogs().showCancelSubscriptionFlow
    ).not.toHaveBeenCalled()
  })

  it('puts Cancel plan ahead of the shared workspace actions', () => {
    useBillingCapabilities().canCancel = computed(() => true)
    grantLeave()
    grantDelete()

    const { menuItems } = useWorkspaceMenuItems()

    expect(menuItems.value.map((item) => item.label)).toEqual([
      'subscription.cancelPlan',
      'workspacePanel.menu.leaveWorkspace',
      'workspacePanel.menu.deleteWorkspace'
    ])
  })

  it('separates every menu entry with a divider', () => {
    useBillingCapabilities().canCancel = computed(() => true)
    grantLeave()
    denyDelete('not_workspace_owner')

    const { menuEntries } = useWorkspaceMenuItems()

    expect(
      menuEntries.value.map((item) => (item.separator ? '|' : item.label))
    ).toEqual([
      'subscription.cancelPlan',
      '|',
      'workspacePanel.menu.leaveWorkspace'
    ])
  })

  it('tells the owner of a cancelled plan when Delete becomes available', () => {
    denyDelete('plan_not_ended')
    state.isSubscriptionCancelled = true

    const { menuItems } = useWorkspaceMenuItems(enMessages)
    const deleteItem = menuItems.value.find(
      (item) => item.label === 'Delete Workspace'
    )

    expect(deleteItem?.tooltip).toBe(
      'You can delete this workspace after your plan ends on Aug 1, 2026.'
    )
  })
})
