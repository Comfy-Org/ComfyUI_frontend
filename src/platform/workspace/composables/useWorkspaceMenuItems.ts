import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MenuItem } from 'primevue/menuitem'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { isSalesManagedTier } from '@/platform/cloud/subscription/constants/tierPricing'
import { isCloud } from '@/platform/distribution/types'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

/**
 * Builds the Plan & Credits overflow-menu model for the workspace subscription
 * panel. Visibility and the Delete enable/disable policy are derived from the
 * shared useWorkspaceUI state so this menu can't desync with the sibling
 * Plan & Credits panel menu.
 */
export function useWorkspaceMenuItems() {
  const { t } = useI18n()
  const { billingStatus, isFreeTier, subscription } = useBillingContext()
  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const { canCancel } = useBillingCapabilities()
  const {
    permissions,
    uiConfig,
    isInPersonalWorkspace,
    isActiveSubscription,
    isSubscriptionCancelled,
    isDeleteDisabled,
    deleteDisabledTooltipKey
  } = useWorkspaceUI()
  const {
    showCancelSubscriptionFlow,
    showEditWorkspaceDialog,
    showDeleteWorkspaceDialog,
    showLeaveWorkspaceDialog
  } = useDialogService()

  function editWorkspace() {
    void showEditWorkspaceDialog()
  }

  function cancelSubscription() {
    if (isCloud && shouldUseWorkspaceBilling.value && !canCancel.value) return
    if (!canCancelPlan.value) return
    void showCancelSubscriptionFlow(subscription.value?.endDate ?? undefined)
  }

  function deleteWorkspace() {
    if (
      !permissions.value.canManageSubscription ||
      isInPersonalWorkspace.value ||
      isDeleteDisabled.value
    ) {
      return
    }
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
      (isActiveSubscription.value ||
        ((billingStatus.value === 'payment_failed' ||
          billingStatus.value === 'paused') &&
          Boolean(subscription.value?.planSlug))) &&
      !isSubscriptionCancelled.value &&
      !isFreeTier.value &&
      !isSalesManagedTier(subscription.value?.tier)
    )
  })

  // Deleting a workspace requires cancelling its plan first, and an Enterprise
  // plan only ends through sales — so Delete would be a permanently disabled
  // dead end. Hidden entirely per DES-782.
  const canDeleteWorkspace = computed(
    () =>
      permissions.value.canManageSubscription &&
      !isInPersonalWorkspace.value &&
      subscription.value?.tier !== 'ENTERPRISE'
  )

  const deleteTooltip = computed(() => {
    const key = deleteDisabledTooltipKey.value
    return key ? t(key) : undefined
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

    if (canDeleteWorkspace.value) {
      items.push({
        label: t('workspacePanel.menu.deleteWorkspace'),
        class: isDeleteDisabled.value
          ? 'data-disabled:cursor-not-allowed data-disabled:text-destructive-background/50 data-disabled:pointer-events-auto'
          : 'text-destructive-background',
        disabled: isDeleteDisabled.value,
        tooltip: deleteTooltip.value,
        command: isDeleteDisabled.value ? undefined : deleteWorkspace
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
