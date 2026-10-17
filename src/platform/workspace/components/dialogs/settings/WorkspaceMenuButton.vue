<template>
  <Menu :items="menuItems">
    <template #trigger>
      <Button
        :tooltip="$t('g.moreOptions')"
        variant="muted-textonly"
        size="icon-lg"
        :aria-label="$t('g.moreOptions')"
        icon="icon-[lucide--ellipsis]"
      />
    </template>
  </Menu>
</template>

<script setup lang="ts">
import type { MenuItem } from '@/components/ui/menu/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Menu from '@/components/ui/menu/Menu.vue'
import Button from '@/components/ui/button/Button.vue'
import { useDeleteWorkspaceGate } from '@/platform/workspace/composables/useDeleteWorkspaceGate'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'

const { t } = useI18n()
const {
  showLeaveWorkspaceDialog,
  showDeleteWorkspaceDialog,
  showEditWorkspaceDialog
} = useWorkspaceDialogs()
const { permissions, uiConfig } = useWorkspaceUI()
const { gate: deleteGate, tooltip: deleteTooltip } = useDeleteWorkspaceGate()

function leaveWorkspace() {
  if (!permissions.value.canLeaveWorkspace) return
  void showLeaveWorkspaceDialog()
}

function deleteWorkspace() {
  if (deleteGate.value.status !== 'enabled') return
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

  if (deleteGate.value.status !== 'hidden') {
    const disabled = deleteGate.value.status === 'disabled'
    items.push({
      label: t('workspacePanel.menu.deleteWorkspace'),
      icon: 'pi pi-trash',
      variant: 'destructive',
      disabled,
      tooltip: deleteTooltip.value,
      command: disabled ? undefined : deleteWorkspace
    })
  }

  if (permissions.value.canLeaveWorkspace) {
    items.push({
      label: t('workspacePanel.menu.leaveWorkspace'),
      icon: 'pi pi-sign-out',
      command: leaveWorkspace
    })
  }

  return items
})
</script>
