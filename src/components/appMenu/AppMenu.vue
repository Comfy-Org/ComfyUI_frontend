<template>
  <Panel v-if="visible" class="app-menu">
    <div class="app-menu-content">
      <div class="queue-button-group flex flex-row">
        <SplitButton
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
              severity="secondary"
              text
              v-tooltip="item.tooltip"
            />
          </template>
        </SplitButton>
        <BatchCountEdit />
        <ButtonGroup class="execution-actions" v-if="executingPrompt">
          <Button
            v-tooltip.bottom="$t('menu.interrupt')"
            icon="pi pi-times"
            severity="danger"
            @click="() => commandStore.getCommand('Comfy.Interrupt')()"
          >
          </Button>
        </ButtonGroup>
      </div>
      <div class="separator"></div>
      <ButtonGroup>
        <Button
          v-tooltip.bottom="$t('menu.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          @click="
            () => commandStore.getCommand('Comfy.RefreshNodeDefinitions')()
          "
        />
        <Button
          v-tooltip.bottom="$t('menu.resetView')"
          icon="pi pi-expand"
          severity="secondary"
          @click="() => commandStore.getCommand('Comfy.ResetView')()"
        />
      </ButtonGroup>
    </div>
  </Panel>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import Panel from 'primevue/panel'
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
  Object.values(queueModeMenuItemLookup).filter(
    (item) => item.key !== queueMode.value
  )
)

const executingPrompt = computed(() => !!queueCountStore.count.value)

const queuePrompt = (e: MouseEvent) => {
  app.queuePrompt(e.shiftKey ? -1 : 0, batchCount.value)
}
</script>

<style scoped>
.app-menu {
  pointer-events: all;
  position: fixed;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.app-menu-content {
  display: flex;
  gap: 10px;
  align-items: center;
}

:deep(.p-panel-content) {
  padding: 10px;
}

:deep(.p-panel-header) {
  display: none;
}

.separator {
  background-color: var(--p-content-border-color);
  border-radius: 10px;
  opacity: 0.75;
  width: 5px;
  height: 20px;
}

.queue-options {
  display: flex;
}

.p-slider {
  --p-slider-border-radius: 5px;
  margin: 5px;
  padding: 2px;
}

.p-floatlabel label {
  left: 2px;
}

.label {
  font-size: 12px;
  color: var(--p-floatlabel-focus-color);
}

.auto-queue {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
}

.auto-queue-mode {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
