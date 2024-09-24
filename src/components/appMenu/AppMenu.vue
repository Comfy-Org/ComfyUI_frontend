<template>
  <Panel v-if="visible" class="app-menu">
    <div class="app-menu-content">
      <Popover ref="queuePopover" data-testid="queue-options">
        <div class="queue-options">
          <p class="batch-count">
            <FloatLabel v-tooltip="$t('menu.batchCountTooltip')">
              <InputNumber id="batchCount" v-model="batchCount" :min="1" />
              <label for="batchCount">{{ $t('menu.batchCount') }}</label>
            </FloatLabel>

            <Slider
              v-model="batchCount"
              :min="1"
              :max="100"
              v-tooltip="$t('menu.batchCountTooltip')"
            />
          </p>

          <Divider layout="vertical" />

          <p class="auto-queue">
            <span class="label">{{ $t('menu.autoQueue') }}</span>
            <template v-for="mode in queueModes" :key="mode">
              <div
                v-tooltip="$t(`menu.${mode}Tooltip`)"
                class="auto-queue-mode"
              >
                <RadioButton
                  v-model="queueMode"
                  :inputId="`autoqueue-${mode}`"
                  name="dynamic"
                  :value="mode"
                  :data-testid="`autoqueue-${mode}`"
                />
                <label :for="`autoqueue-${mode}`">{{
                  $t(`menu.${mode}`)
                }}</label>
              </div>
            </template>
          </p>
        </div>
      </Popover>
      <SplitButton
        v-tooltip.bottom="$t('menu.queueWorkflow')"
        :label="$t('menu.generate')"
        :icon="`pi pi-${icon}`"
        severity="secondary"
        @click="queuePrompt"
        :model="[]"
        :pt="{
          pcDropdown: ({ instance }) => {
            instance.onDropdownButtonClick = function (e: Event) {
              e.preventDefault()
              queuePopover.toggle(e)
            }
          }
        }"
        data-testid="queue-button"
      >
      </SplitButton>
      <div class="separator"></div>
      <Button
        v-tooltip.bottom="$t('menu.interrupt')"
        icon="pi pi-times"
        severity="secondary"
        :disabled="!executingPrompt"
        @click="() => commandStore.getCommand('Comfy.Interrupt')()"
      ></Button>

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
          v-tooltip.bottom="$t('menu.clipspace')"
          icon="pi pi-clipboard"
          severity="secondary"
          @click="() => commandStore.getCommand('Comfy.OpenClipspace')()"
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
import { computed, ref } from 'vue'
import Panel from 'primevue/panel'
import SplitButton from 'primevue/splitbutton'
import Button from 'primevue/button'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import Popover from 'primevue/popover'
import Divider from 'primevue/divider'
import Slider from 'primevue/slider'
import RadioButton from 'primevue/radiobutton'
import ButtonGroup from 'primevue/buttongroup'
import {
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'
import { app } from '@/scripts/app'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/settingStore'
import { useCommandStore } from '@/stores/commandStore'

const settingsStore = useSettingStore()
const commandStore = useCommandStore()
const queueCountStore = storeToRefs(useQueuePendingTaskCountStore())
const { batchCount, mode: queueMode } = storeToRefs(useQueueSettingsStore())

const visible = computed(
  () => settingsStore.get('Comfy.UseNewMenu') === 'Floating'
)

const queuePopover = ref(null)
const queueModes = ['disabled', 'instant', 'change']

const icon = computed(() => {
  switch (queueMode.value) {
    case 'instant':
      return 'forward'
    case 'change':
      return 'step-forward-alt'
    default:
      return 'play'
  }
})

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

.batch-count {
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1em;
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
