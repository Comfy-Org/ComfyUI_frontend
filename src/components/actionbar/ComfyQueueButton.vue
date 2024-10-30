<template>
  <div class="queue-button-group flex">
    <SplitButton
      class="comfyui-queue-button"
      :label="activeQueueModeMenuItem.label"
      severity="primary"
      @click="queuePrompt"
      :model="queueModeMenuItems"
      data-testid="queue-button"
      v-tooltip.bottom="
        workspaceStore.shiftDown
          ? $t('menu.queueWorkflowFront')
          : $t('menu.queueWorkflow')
      "
    >
      <template #icon>
        <i-lucide:list-start v-if="workspaceStore.shiftDown" />
        <i v-else :class="activeQueueModeMenuItem.icon" />
      </template>
      <template #item="{ item }">
        <Button
          :label="item.label"
          :icon="item.icon"
          :severity="item.key === queueMode ? 'primary' : 'secondary'"
          text
          v-tooltip="item.tooltip"
        />
      </template>
    </SplitButton>
    <BatchCountEdit />
    <ButtonGroup class="execution-actions flex flex-nowrap">
      <Button
        v-tooltip.bottom="$t('menu.interrupt')"
        icon="pi pi-times"
        :severity="executingPrompt ? 'danger' : 'secondary'"
        :disabled="!executingPrompt"
        text
        @click="() => commandStore.execute('Comfy.Interrupt')"
      >
      </Button>
      <Button
        v-tooltip.bottom="$t('sideToolbar.queueTab.clearPendingTasks')"
        icon="pi pi-stop"
        :severity="hasPendingTasks ? 'danger' : 'secondary'"
        :disabled="!hasPendingTasks"
        text
        @click="() => commandStore.execute('Comfy.ClearPendingTasks')"
      />
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import SplitButton from 'primevue/splitbutton'
import Button from 'primevue/button'
import BatchCountEdit from './BatchCountEdit.vue'
import ButtonGroup from 'primevue/buttongroup'
import { useI18n } from 'vue-i18n'
import {
  AutoQueueMode,
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'
import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useCommandStore } from '@/stores/commandStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const workspaceStore = useWorkspaceStore()
const queueCountStore = storeToRefs(useQueuePendingTaskCountStore())
const { mode: queueMode } = storeToRefs(useQueueSettingsStore())

const { t } = useI18n()
const queueModeMenuItemLookup: Record<AutoQueueMode, MenuItem> = {
  disabled: {
    key: 'disabled',
    label: 'Queue',
    icon: 'pi pi-play',
    tooltip: t('menu.disabledTooltip'),
    command: () => {
      queueMode.value = 'disabled'
    }
  },
  instant: {
    key: 'instant',
    label: 'Queue (Instant)',
    icon: 'pi pi-forward',
    tooltip: t('menu.instantTooltip'),
    command: () => {
      queueMode.value = 'instant'
    }
  },
  change: {
    key: 'change',
    label: 'Queue (Change)',
    icon: 'pi pi-step-forward-alt',
    tooltip: t('menu.changeTooltip'),
    command: () => {
      queueMode.value = 'change'
    }
  }
}

const activeQueueModeMenuItem = computed(
  () => queueModeMenuItemLookup[queueMode.value]
)
const queueModeMenuItems = computed(() =>
  Object.values(queueModeMenuItemLookup)
)

const executingPrompt = computed(() => !!queueCountStore.count.value)
const hasPendingTasks = computed(() => queueCountStore.count.value > 1)

const commandStore = useCommandStore()
const queuePrompt = (e: MouseEvent) => {
  const commandId = e.shiftKey ? 'Comfy.QueuePromptFront' : 'Comfy.QueuePrompt'
  commandStore.execute(commandId)
}
</script>

<style scoped>
.comfyui-queue-button :deep(.p-splitbutton-dropdown) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
