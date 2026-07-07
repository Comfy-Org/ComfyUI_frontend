<template>
  <DropdownMenu
    v-if="menuItems.length > 0"
    :entries="menuItems"
    :modal="false"
    @close-auto-focus="onMenuCloseAutoFocus"
  >
    <template #button>
      <Button
        v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
        variant="secondary"
        size="icon-lg"
        class="rounded-lg"
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
import { useWorkspaceRename } from '@/platform/workspace/composables/useWorkspaceRename'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

const { t } = useI18n()
const { showLeaveWorkspaceDialog, showDeleteWorkspaceDialog } =
  useDialogService()
const { isWorkspaceSubscribed, isCurrentUserOriginalOwner } = storeToRefs(
  useTeamWorkspaceStore()
)
const { uiConfig } = useWorkspaceUI()
const { startRenaming } = useWorkspaceRename()

// Reka returns focus to the trigger when the menu closes, which would blur (and
// so tear down) the rename input we're about to focus. Suppress that focus
// restoration for the one close that kicks off a rename.
let renameStarting = false

function beginRename() {
  renameStarting = true
  startRenaming()
}

function onMenuCloseAutoFocus(event: Event) {
  if (!renameStarting) return
  renameStarting = false
  event.preventDefault()
}

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

const menuItems = computed<MenuItem[]>(() => {
  const renameItems: MenuItem[] = uiConfig.value.showEditWorkspaceMenuItem
    ? [
        {
          label: t('workspacePanel.menu.renameWorkspace'),
          command: beginRename
        }
      ]
    : []

  const destructiveItems: MenuItem[] = []
  const action = uiConfig.value.workspaceMenuAction
  if (action === 'delete') {
    destructiveItems.push({
      label: t('workspacePanel.menu.deleteWorkspace'),
      class: isDeleteDisabled.value ? undefined : 'text-danger',
      disabled: isDeleteDisabled.value,
      tooltip: deleteTooltip.value,
      command: isDeleteDisabled.value
        ? undefined
        : () => showDeleteWorkspaceDialog()
    })
  }

  // Members and non-creator owners can leave; the creator sees it disabled.
  if (action === 'leave' || action === 'delete') {
    destructiveItems.push(
      isCurrentUserOriginalOwner.value
        ? {
            label: t('workspacePanel.menu.leaveWorkspace'),
            disabled: true,
            tooltip: t('workspacePanel.menu.creatorCannotLeave')
          }
        : {
            label: t('workspacePanel.menu.leaveWorkspace'),
            command: () => showLeaveWorkspaceDialog()
          }
    )
  }

  const divider: MenuItem[] =
    renameItems.length && destructiveItems.length ? [{ separator: true }] : []

  return [...renameItems, ...divider, ...destructiveItems]
})
</script>
