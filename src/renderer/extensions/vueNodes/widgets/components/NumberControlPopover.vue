<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogService } from '@/services/dialogService'

import { NumberControlMode } from '../composables/useStepperControl'

type ControlOption = {
  mode: NumberControlMode
  icon?: string
  title: string
  description: string
  text?: string
}

const popover = ref()
const settingStore = useSettingStore()
const dialogService = useDialogService()

const toggle = (event: Event) => {
  popover.value.toggle(event)
}
defineExpose({ toggle })

const ENABLE_LINK_TO_GLOBAL = false

const controlOptions: ControlOption[] = [
  ...(ENABLE_LINK_TO_GLOBAL
    ? ([
        {
          mode: NumberControlMode.LINK_TO_GLOBAL,
          icon: 'pi pi-link',
          title: 'linkToGlobal',
          description: 'linkToGlobalDesc'
        } satisfies ControlOption
      ] as ControlOption[])
    : []),
  {
    mode: NumberControlMode.RANDOMIZE,
    icon: 'icon-[lucide--shuffle]',
    title: 'randomize',
    description: 'randomizeDesc'
  },
  {
    mode: NumberControlMode.INCREMENT,
    text: '+1',
    title: 'increment',
    description: 'incrementDesc'
  },
  {
    mode: NumberControlMode.DECREMENT,
    text: '-1',
    title: 'decrement',
    description: 'decrementDesc'
  }
]

const widgetControlMode = computed(() =>
  settingStore.get('Comfy.WidgetControlMode')
)

const props = defineProps<{
  controlMode: NumberControlMode
}>()

const emit = defineEmits<{
  'update:controlMode': [mode: NumberControlMode]
}>()

const handleToggle = (mode: NumberControlMode) => {
  if (props.controlMode === mode) return
  emit('update:controlMode', mode)
}

const isActive = (mode: NumberControlMode) => {
  return props.controlMode === mode
}

const handleEditSettings = () => {
  popover.value.hide()
  dialogService.showSettingsDialog()
}
</script>

<template>
  <Popover ref="popover">
    <div class="w-105 p-4 space-y-4">
      <p class="text-sm text-slate-100">
        {{ $t('widgets.numberControl.controlHeaderBefore') }}
        <span class="text-white">
          {{
            widgetControlMode === 'before'
              ? $t('widgets.numberControl.controlHeaderBefore2')
              : $t('widgets.numberControl.controlHeaderAfter')
          }}
        </span>
        {{ $t('widgets.numberControl.controlHeaderEnd') }}
      </p>

      <div class="space-y-2">
        <div
          v-for="option in controlOptions"
          :key="option.mode"
          class="flex items-center justify-between p-2 rounded"
        >
          <div class="flex gap-3 flex-1">
            <div
              class="w-8 h-8 bg-charcoal-400 rounded-lg flex items-center justify-center flex-shrink-0"
            >
              <i v-if="option.icon" :class="`${option.icon} text-sm`" />
              <span v-if="option.text" class="text-xs">
                {{ option.text }}
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-normal">
                <span v-if="option.mode === NumberControlMode.LINK_TO_GLOBAL">
                  {{ $t('widgets.numberControl.linkToGlobal') }}
                  <em>{{ $t('widgets.numberControl.linkToGlobalSeed') }}</em>
                </span>
                <span v-else>
                  {{ $t(`widgets.numberControl.${option.title}`) }}
                </span>
              </div>
              <div class="text-sm font-normal text-slate-100">
                {{ $t(`widgets.numberControl.${option.description}`) }}
              </div>
            </div>
          </div>
          <ToggleSwitch
            :model-value="isActive(option.mode)"
            class="flex-shrink-0"
            @update:model-value="handleToggle(option.mode)"
          />
        </div>
      </div>

      <hr class="border-charcoal-400 border-1" />

      <Button
        severity="secondary"
        size="small"
        class="w-full"
        @click="handleEditSettings"
      >
        <i class="pi pi-cog mr-2 text-xs" />
        {{ $t('widgets.numberControl.editSettings') }}
      </Button>
    </div>
  </Popover>
</template>
