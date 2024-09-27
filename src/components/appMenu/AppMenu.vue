<template>
  <Panel v-if="visible" class="app-menu">
    <div class="app-menu-content flex align-center">
      <div class="queue-button-group flex">
        <SplitButton
          class="comfyui-queue-button"
          :label="activeQueueModeMenuItem.label"
          :icon="activeQueueModeMenuItem.icon"
          severity="primary"
          @click="queuePrompt"
          :model="queueModeMenuItems"
          data-testid="queue-button"
          v-tooltip.bottom="$t('menu.queueWorkflow')"
        >
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
        <ButtonGroup class="execution-actions ml-2">
          <Button
            v-tooltip.bottom="$t('menu.interrupt')"
            icon="pi pi-times"
            :severity="executingPrompt ? 'danger' : 'secondary'"
            :disabled="!executingPrompt"
            @click="() => commandStore.getCommandFunction('Comfy.Interrupt')()"
          >
          </Button>
          <Button
            v-tooltip.bottom="$t('sideToolbar.queueTab.clearPendingTasks')"
            icon="pi pi-stop"
            :severity="hasPendingTasks ? 'danger' : 'secondary'"
            :disabled="!hasPendingTasks"
            @click="
              () => commandStore.getCommandFunction('Comfy.ClearPendingTasks')()
            "
          />
        </ButtonGroup>
      </div>
      <Divider layout="vertical" class="mx-2" />
      <ButtonGroup>
        <Button
          v-tooltip.bottom="$t('menu.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          @click="
            () =>
              commandStore.getCommandFunction('Comfy.RefreshNodeDefinitions')()
          "
        />
        <Button
          v-tooltip.bottom="$t('menu.resetView')"
          icon="pi pi-expand"
          severity="secondary"
          @click="() => commandStore.getCommandFunction('Comfy.ResetView')()"
        />
      </ButtonGroup>
    </div>
  </Panel>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import Panel from 'primevue/panel'
import Divider from 'primevue/divider'
import SplitButton from 'primevue/splitbutton'
import Button from 'primevue/button'
import ButtonGroup from 'primevue/buttongroup'
import BatchCountEdit from './BatchCountEdit.vue'
import {
  AutoQueueMode,
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'
import { app } from '@/scripts/app'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { MenuItem } from 'primevue/menuitem'
import { useI18n } from 'vue-i18n'

const settingsStore = useSettingStore()
const commandStore = useCommandStore()
const queueCountStore = storeToRefs(useQueuePendingTaskCountStore())
const { batchCount, mode: queueMode } = storeToRefs(useQueueSettingsStore())

const visible = computed(
  () => settingsStore.get('Comfy.UseNewMenu') === 'Floating'
)

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

const queuePrompt = (e: MouseEvent) => {
  app.queuePrompt(e.shiftKey ? -1 : 0, batchCount.value)
}
</script>

<style scoped>
.app-menu {
  pointer-events: all;
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

:deep(.p-panel-content) {
  padding: 10px;
}

:deep(.p-panel-header) {
  display: none;
}

.comfyui-queue-button :deep(.p-splitbutton-dropdown) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
