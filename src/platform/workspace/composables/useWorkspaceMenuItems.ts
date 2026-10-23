import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MenuItem } from '@/components/ui/menu/types'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import { isSalesManagedTier } from '@/platform/billing/subscription/constants/tierPricing'
import { isCloud } from '@/platform/distribution/types'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useDeleteWorkspaceGate } from '@/platform/workspace/composables/useDeleteWorkspaceGate'
import { useLeaveWorkspaceGate } from '@/platform/workspace/composables/useLeaveWorkspaceGate'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'

interface GatedItem {
  label: string
  tooltip: string | undefined
  command: () => void
  variant?: 'destructive'
}

function gatedItem(status: 'enabled' | 'disabled', item: GatedItem): MenuItem {
  return {
    ...item,
    disabled: status === 'disabled',
    focusableWhenDisabled: true
  }
}

/** Edit, Leave and Delete workspace: the one source for every workspace ⋯ menu. */
export function useWorkspaceActionMenuItems() {
  const { t } = useI18n()
  const { canEditWorkspace } = useBillingCapabilities()
  const { gate: leaveGate, tooltip: leaveTooltip } = useLeaveWorkspaceGate()
  const { gate: deleteGate, tooltip: deleteTooltip } = useDeleteWorkspaceGate()
  const {
    showEditWorkspaceDialog,
    showDeleteWorkspaceDialog,
    showLeaveWorkspaceDialog
  } = useWorkspaceDialogs()

  function leaveWorkspace() {
    if (leaveGate.value.status !== 'enabled') return
    void showLeaveWorkspaceDialog()
  }

  function deleteWorkspace() {
    if (deleteGate.value.status !== 'enabled') return
    void showDeleteWorkspaceDialog()
  }

  return computed<MenuItem[]>(() => {
    const items: MenuItem[] = []
    if (canEditWorkspace.value) {
      items.push({
        label: t('workspacePanel.menu.editWorkspace'),
        command: () => void showEditWorkspaceDialog()
      })
    }
    const leave = leaveGate.value
    if (leave.status !== 'hidden') {
      items.push(
        gatedItem(leave.status, {
          label: t('workspacePanel.menu.leaveWorkspace'),
          tooltip: leaveTooltip.value,
          command: leaveWorkspace
        })
      )
    }
    const remove = deleteGate.value
    if (remove.status !== 'hidden') {
      items.push(
        gatedItem(remove.status, {
          label: t('workspacePanel.menu.deleteWorkspace'),
          tooltip: deleteTooltip.value,
          command: deleteWorkspace,
          variant: 'destructive'
        })
      )
    }
    return items
  })
}

/**
 * Builds the Plan & Credits overflow-menu model: Cancel plan followed by the
 * shared workspace actions.
 */
export function useWorkspaceMenuItems() {
  const { t } = useI18n()
  const { billingStatus, isFreeTier, subscription } = useBillingContext()
  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const { canCancel } = useBillingCapabilities()
  const {
    permissions,
    canAccessSubscriptionFeatures,
    isSubscriptionCancelled
  } = useWorkspaceUI()
  const workspaceActionItems = useWorkspaceActionMenuItems()
  const { showCancelSubscriptionFlow } = useBillingDialogs()

  function cancelSubscription() {
    if (isCloud && shouldUseWorkspaceBilling.value && !canCancel.value) return
    if (!canCancelPlan.value) return
    void showCancelSubscriptionFlow(subscription.value?.endDate ?? undefined)
  }

  const canCancelPlan = computed(() => {
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

  const menuItems = computed<MenuItem[]>(() => [
    ...(canCancelPlan.value
      ? [{ label: t('subscription.cancelPlan'), command: cancelSubscription }]
      : []),
    ...workspaceActionItems.value
  ])

  const menuEntries = computed<MenuItem[]>(() =>
    menuItems.value.flatMap((item, index) =>
      index === 0 ? [item] : [{ separator: true }, item]
    )
  )

  return { menuItems, menuEntries }
}
