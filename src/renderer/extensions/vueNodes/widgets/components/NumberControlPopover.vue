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
  <Popover
    ref="popover"
    class="bg-interface-panel-surface border border-interface-stroke rounded-lg"
  >
    <!-- Responsive width with proper constraints -->
    <div class="w-113 max-w-md p-4 space-y-4">
      <!-- Header text with semantic tokens -->
      <div class="text-sm text-muted-foreground leading-tight">
        {{ $t('widgets.numberControl.controlHeaderBefore') }}
        <span class="text-base-foreground font-medium">
          {{
            widgetControlMode === 'before'
              ? $t('widgets.numberControl.controlHeaderBefore2')
              : $t('widgets.numberControl.controlHeaderAfter')
          }}
        </span>
        {{ $t('widgets.numberControl.controlHeaderEnd') }}
      </div>

      <!-- Control options with proper spacing -->
      <div class="space-y-2">
        <div
          v-for="option in controlOptions"
          :key="option.mode"
          class="flex items-center justify-between py-2 gap-7"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <!-- Icon container with semantic background -->
            <div
              class="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 bg-secondary-background border border-border-subtle"
            >
              <i
                v-if="option.icon"
                :class="option.icon"
                class="text-base text-base-foreground"
              />
              <span
                v-if="option.text"
                class="text-xs font-normal text-base-foreground"
              >
                {{ option.text }}
              </span>
            </div>

            <!-- Text content with proper semantic colors -->
            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
              <div
                class="text-sm font-normal text-base-foreground leading-tight"
              >
                <span v-if="option.mode === NumberControlMode.LINK_TO_GLOBAL">
                  {{ $t('widgets.numberControl.linkToGlobal') }}
                  <em>{{ $t('widgets.numberControl.linkToGlobalSeed') }}</em>
                </span>
                <span v-else>
                  {{ $t(`widgets.numberControl.${option.title}`) }}
                </span>
              </div>
              <div
                class="text-sm font-normal text-muted-foreground leading-tight"
              >
                {{ $t(`widgets.numberControl.${option.description}`) }}
              </div>
            </div>
          </div>

          <!-- Toggle switch with proper sizing -->
          <ToggleSwitch
            :model-value="isActive(option.mode)"
            class="flex-shrink-0"
            @update:model-value="handleToggle(option.mode)"
          />
        </div>
      </div>

      <!-- Divider using semantic border -->
      <div class="border-t border-border-subtle"></div>

      <!-- Settings button with semantic styling -->
      <Button
        class="w-full bg-secondary-background hover:bg-secondary-background-hover border-0 rounded-lg p-2 text-sm"
        @click="handleEditSettings"
      >
        <div class="flex items-center justify-center gap-1">
          <i class="pi pi-cog text-xs text-muted-foreground" />
          <span class="font-normal text-base-foreground">{{
            $t('widgets.numberControl.editSettings')
          }}</span>
        </div>
      </Button>
    </div>
  </Popover>
</template>
