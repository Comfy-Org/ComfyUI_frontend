import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MenuItem } from '@/components/ui/menu/types'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { isSalesManagedTier } from '@/platform/cloud/subscription/constants/tierPricing'
import { isCloud } from '@/platform/distribution/types'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useDeleteWorkspaceGate } from '@/platform/workspace/composables/useDeleteWorkspaceGate'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'

/**
 * Builds the Plan & Credits overflow-menu model for the workspace subscription
 * panel. The Delete item renders the shared useDeleteWorkspaceGate result so
 * this menu can't desync with the Members panel menu.
 */
export function useWorkspaceMenuItems() {
  const { t } = useI18n()
  const { billingStatus, isFreeTier, subscription } = useBillingContext()
  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const { canCancel } = useBillingCapabilities()
  const {
    permissions,
    uiConfig,
    canAccessSubscriptionFeatures,
    isSubscriptionCancelled
  } = useWorkspaceUI()
  const { gate: deleteGate, tooltip: deleteTooltip } = useDeleteWorkspaceGate()
  const { showCancelSubscriptionFlow } = useBillingDialogs()
  const {
    showEditWorkspaceDialog,
    showDeleteWorkspaceDialog,
    showLeaveWorkspaceDialog
  } = useWorkspaceDialogs()

  function editWorkspace() {
    void showEditWorkspaceDialog()
  }

  function cancelSubscription() {
    if (isCloud && shouldUseWorkspaceBilling.value && !canCancel.value) return
    if (!canCancelPlan.value) return
    void showCancelSubscriptionFlow(subscription.value?.endDate ?? undefined)
  }

  function deleteWorkspace() {
    if (deleteGate.value.status !== 'enabled') return
    void showDeleteWorkspaceDialog()
  }

  function leaveWorkspace() {
    if (!permissions.value.canLeaveWorkspace) return
    void showLeaveWorkspaceDialog()
  }

  const canCancelPlan = computed(() => {
    // can_cancel already encodes role, subscription presence/status and a
    // scheduled cancellation, but not tier: it stays true for an active FREE
    // plan, so the free-tier guard has to remain client-side.
    if (isCloud && shouldUseWorkspaceBilling.value)
      return canCancel.value && !isFreeTier.value
    return (
      permissions.value.canManageSubscriptionLifecycle &&
      (canAccessSubscriptionFeatures.value ||
        ((billingStatus.value === 'payment_failed' ||
          billingStatus.value === 'paused') &&
          Boolean(subscription.value?.planSlug))) &&
      !isSubscriptionCancelled.value &&
      !isFreeTier.value &&
      !isSalesManagedTier(subscription.value?.tier)
    )
  })

  const menuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = []

    if (uiConfig.value.showEditWorkspaceMenuItem) {
      items.push({
        label: t('workspacePanel.menu.editWorkspace'),
        command: editWorkspace
      })
    }

    if (canCancelPlan.value) {
      items.push({
        label: t('subscription.cancelPlan'),
        command: cancelSubscription
      })
    }

    if (deleteGate.value.status !== 'hidden') {
      const disabled = deleteGate.value.status === 'disabled'
      items.push({
        label: t('workspacePanel.menu.deleteWorkspace'),
        class: disabled
          ? 'data-disabled:cursor-not-allowed data-disabled:text-destructive-background/50 data-disabled:pointer-events-auto'
          : 'text-destructive-background',
        disabled,
        tooltip: deleteTooltip.value,
        command: disabled ? undefined : deleteWorkspace
      })
    }

    if (permissions.value.canLeaveWorkspace) {
      items.push({
        label: t('workspacePanel.menu.leaveWorkspace'),
        command: leaveWorkspace
      })
    }

    return items
  })

  // Figma 3343-25140 renders a divider between every menu option.
  const menuEntries = computed<MenuItem[]>(() =>
    menuItems.value.flatMap((item, index) =>
      index === 0 ? [item] : [{ separator: true }, item]
    )
  )

  return { menuItems, menuEntries }
}
