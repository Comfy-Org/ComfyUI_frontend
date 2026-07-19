<template>
  <DropdownMenu :entries="menuItems">
    <template #button>
      <Button
        v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
        variant="muted-textonly"
        size="icon-lg"
        :aria-label="$t('g.moreOptions')"
      >
        <i class="pi pi-ellipsis-h" />
      </Button>
    </template>
  </DropdownMenu>
</template>

<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

const { t } = useI18n()
const {
  showLeaveWorkspaceDialog,
  showDeleteWorkspaceDialog,
  showEditWorkspaceDialog
} = useDialogService()
const { isWorkspaceSubscribed, isCurrentUserOriginalOwner } = storeToRefs(
  useTeamWorkspaceStore()
)
const { permissions, uiConfig } = useWorkspaceUI()

// Disable delete when the workspace has an active subscription (prevents
// accidental deletion); uses the workspace's own status, not the global one.
const isDeleteDisabled = computed(
  () =>
    uiConfig.value.workspaceMenuAction === 'delete' &&
    isWorkspaceSubscribed.value
)

const deleteTooltip = computed(() => {
  if (!isDeleteDisabled.value) return undefined
  const tooltipKey = uiConfig.value.workspaceMenuDisabledTooltip
  return tooltipKey ? t(tooltipKey) : undefined
})

function leaveWorkspace() {
  if (!permissions.value.canLeaveWorkspace) return
  void showLeaveWorkspaceDialog()
}

function deleteWorkspace() {
  if (!isCurrentUserOriginalOwner.value || isDeleteDisabled.value) return
  void showDeleteWorkspaceDialog()
}

const menuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []

  if (uiConfig.value.showEditWorkspaceMenuItem) {
    items.push({
      label: t('workspacePanel.menu.editWorkspace'),
      icon: 'pi pi-pencil',
      command: () => showEditWorkspaceDialog()
    })
  }

  if (
    uiConfig.value.workspaceMenuAction === 'delete' &&
    isCurrentUserOriginalOwner.value
  ) {
    items.push({
      label: t('workspacePanel.menu.deleteWorkspace'),
      icon: 'pi pi-trash',
      class: isDeleteDisabled.value
        ? 'text-destructive-background/50'
        : 'text-destructive-background',
      disabled: isDeleteDisabled.value,
      tooltip: deleteTooltip.value,
      command: isDeleteDisabled.value ? undefined : deleteWorkspace
    })
  }

  if (permissions.value.canLeaveWorkspace) {
    items.push({
      label: t('workspacePanel.menu.leaveWorkspace'),
      icon: 'pi pi-sign-out',
      command: leaveWorkspace
    })
  } else if (
    uiConfig.value.workspaceMenuAction === 'delete' &&
    isCurrentUserOriginalOwner.value
  ) {
    items.push({
      label: t('workspacePanel.menu.leaveWorkspace'),
      icon: 'pi pi-sign-out',
      class: 'opacity-50',
      disabled: true,
      tooltip: t('workspacePanel.menu.creatorCannotLeave')
    })
  }

  return items
})
</script>
