<template>
  <Button
    v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
    variant="muted-textonly"
    size="icon-lg"
    :aria-label="$t('g.moreOptions')"
    @click="menu?.toggle($event)"
  >
    <i class="pi pi-ellipsis-h" />
  </Button>
  <Menu ref="menu" :model="menuItems" :popup="true">
    <template #item="{ item }">
      <button
        v-tooltip="
          item.disabled && deleteTooltip
            ? { value: deleteTooltip, showDelay: 0 }
            : null
        "
        type="button"
        :disabled="!!item.disabled"
        :class="
          cn(
            'flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2',
            item.class,
            item.disabled && 'pointer-events-auto cursor-not-allowed'
          )
        "
        @click="
          item.command?.({
            originalEvent: $event,
            item
          })
        "
      >
        <i :class="item.icon" />
        <span>{{ item.label }}</span>
      </button>
    </template>
  </Menu>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Menu from 'primevue/menu'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const {
  showLeaveWorkspaceDialog,
  showDeleteWorkspaceDialog,
  showEditWorkspaceDialog
} = useDialogService()
const { isWorkspaceSubscribed } = storeToRefs(useTeamWorkspaceStore())
const { uiConfig } = useWorkspaceUI()

const menu = ref<InstanceType<typeof Menu> | null>(null)

// Disable delete when workspace has an active subscription (to prevent accidental deletion)
// Use workspace's own subscription status, not the global isActiveSubscription
const isDeleteDisabled = computed(
  () =>
    uiConfig.value.workspaceMenuAction === 'delete' &&
    isWorkspaceSubscribed.value
)

const deleteTooltip = computed(() => {
  if (!isDeleteDisabled.value) return null
  const tooltipKey = uiConfig.value.workspaceMenuDisabledTooltip
  return tooltipKey ? t(tooltipKey) : null
})

const menuItems = computed(() => {
  const items = []

  // Add edit option for owners
  if (uiConfig.value.showEditWorkspaceMenuItem) {
    items.push({
      label: t('workspacePanel.menu.editWorkspace'),
      icon: 'pi pi-pencil',
      command: () => showEditWorkspaceDialog()
    })
  }

  const action = uiConfig.value.workspaceMenuAction
  if (action === 'delete') {
    items.push({
      label: t('workspacePanel.menu.deleteWorkspace'),
      icon: 'pi pi-trash',
      class: isDeleteDisabled.value
        ? 'text-danger/50 cursor-not-allowed'
        : 'text-danger',
      disabled: isDeleteDisabled.value,
      command: isDeleteDisabled.value
        ? undefined
        : () => showDeleteWorkspaceDialog()
    })
  } else if (action === 'leave') {
    items.push({
      label: t('workspacePanel.menu.leaveWorkspace'),
      icon: 'pi pi-sign-out',
      command: () => showLeaveWorkspaceDialog()
    })
  }

  return items
})
</script>
