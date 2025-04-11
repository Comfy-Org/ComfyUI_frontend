<template>
  <div class="queue-button-group flex">
    <SplitButton
      v-tooltip.bottom="{
        value: workspaceStore.shiftDown
          ? $t('menu.runWorkflowFront')
          : $t('menu.runWorkflow'),
        showDelay: 600
      }"
      class="comfyui-queue-button"
      :label="activeQueueModeMenuItem.label"
      severity="primary"
      size="small"
      :model="queueModeMenuItems"
      data-testid="queue-button"
      @click="queuePrompt"
    >
      <template #icon>
        <i-lucide:list-start v-if="workspaceStore.shiftDown" />
        <i-lucide:play v-else-if="queueMode === 'disabled'" />
        <i-lucide:fast-forward v-else-if="queueMode === 'instant'" />
        <i-lucide:step-forward v-else-if="queueMode === 'change'" />
      </template>
      <template #item="{ item }">
        <Button
          v-tooltip="{
            value: item.tooltip,
            showDelay: 600
          }"
          :label="String(item.label)"
          :icon="item.icon"
          :severity="item.key === queueMode ? 'primary' : 'secondary'"
          size="small"
          text
        />
      </template>
    </SplitButton>
    <BatchCountEdit />
    <ButtonGroup class="execution-actions flex flex-nowrap">
      <Button
        v-tooltip.bottom="{
          value: $t('menu.interrupt'),
          showDelay: 600
        }"
        icon="pi pi-times"
        :severity="executingPrompt ? 'danger' : 'secondary'"
        :disabled="!executingPrompt"
        text
        :aria-label="$t('menu.interrupt')"
        @click="() => commandStore.execute('Comfy.Interrupt')"
      />
      <Button
        v-tooltip.bottom="{
          value: $t('sideToolbar.queueTab.clearPendingTasks'),
          showDelay: 600
        }"
        icon="pi pi-stop"
        :severity="hasPendingTasks ? 'danger' : 'secondary'"
        :disabled="!hasPendingTasks"
        text
        :aria-label="$t('sideToolbar.queueTab.clearPendingTasks')"
        @click="
          () => {
            if (queueCountStore.count.value > 1) {
              commandStore.execute('Comfy.ClearPendingTasks')
            }
            queueMode = 'disabled'
          }
        "
      />
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import ButtonGroup from 'primevue/buttongroup'
import SplitButton from 'primevue/splitbutton'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import {
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import BatchCountEdit from './BatchCountEdit.vue'

const workspaceStore = useWorkspaceStore()
const queueCountStore = storeToRefs(useQueuePendingTaskCountStore())
const { mode: queueMode } = storeToRefs(useQueueSettingsStore())

const { t } = useI18n()
const queueModeMenuItemLookup = computed(() => ({
  disabled: {
    key: 'disabled',
    label: t('menu.run'),
    tooltip: t('menu.disabledTooltip'),
    command: () => {
      queueMode.value = 'disabled'
    }
  },
  instant: {
    key: 'instant',
    label: `${t('menu.run')} (${t('menu.instant')})`,
    tooltip: t('menu.instantTooltip'),
    command: () => {
      queueMode.value = 'instant'
    }
  },
  change: {
    key: 'change',
    label: `${t('menu.run')} (${t('menu.onChange')})`,
    tooltip: t('menu.onChangeTooltip'),
    command: () => {
      queueMode.value = 'change'
    }
  }
}))

const activeQueueModeMenuItem = computed(
  () => queueModeMenuItemLookup.value[queueMode.value]
)
const queueModeMenuItems = computed(() =>
  Object.values(queueModeMenuItemLookup.value)
)

const executingPrompt = computed(() => !!queueCountStore.count.value)
const hasPendingTasks = computed(
  () => queueCountStore.count.value > 1 || queueMode.value !== 'disabled'
)

const commandStore = useCommandStore()
const queuePrompt = async (e: Event) => {
  const commandId =
    'shiftKey' in e && e.shiftKey
      ? 'Comfy.QueuePromptFront'
      : 'Comfy.QueuePrompt'
  await commandStore.execute(commandId)
}
</script>

<style scoped>
.comfyui-queue-button :deep(.p-splitbutton-dropdown) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
