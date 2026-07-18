import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MenuItem } from 'primevue/menuitem'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

/**
 * Builds the Plan & Credits overflow-menu model for the workspace subscription
 * panel. Visibility and the Delete enable/disable policy are derived from the
 * shared useWorkspaceUI state so this menu can't desync with the sibling
 * WorkspacePanelContent menu.
 */
export function useWorkspaceMenuItems() {
  const { t } = useI18n()
  const { isFreeTier, subscription } = useBillingContext()
  const {
    uiConfig,
    isInPersonalWorkspace,
    isActiveSubscription,
    isOriginalOwner,
    isTeamPlanCancelled,
    isDeleteDisabled,
    deleteDisabledTooltipKey
  } = useWorkspaceUI()
  const {
    showCancelSubscriptionDialog,
    showEditWorkspaceDialog,
    showDeleteWorkspaceDialog,
    showLeaveWorkspaceDialog
  } = useDialogService()

  function editWorkspace() {
    void showEditWorkspaceDialog()
  }

  function cancelSubscription() {
    void showCancelSubscriptionDialog(subscription.value?.endDate ?? undefined)
  }

  function deleteWorkspace() {
    void showDeleteWorkspaceDialog()
  }

  function leaveWorkspace() {
    void showLeaveWorkspaceDialog()
  }

  const canCancelPlan = computed(
    () =>
      isOriginalOwner.value &&
      isActiveSubscription.value &&
      !isTeamPlanCancelled.value &&
      !isFreeTier.value
  )

  const canDeleteWorkspace = computed(
    () =>
      isOriginalOwner.value &&
      (!isInPersonalWorkspace.value || isActiveSubscription.value)
  )

  const canLeaveWorkspace = computed(
    () => !isInPersonalWorkspace.value && !isOriginalOwner.value
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

    if (canLeaveWorkspace.value) {
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
