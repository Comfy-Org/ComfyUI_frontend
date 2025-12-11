<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogService } from '@/services/dialogService'
import type { ControlOptions } from '@/types/simplifiedWidget'

type ControlOption = {
  description: string
  mode: ControlOptions
  icon?: string
  text?: string
  title: string
}

const popover = ref()
const settingStore = useSettingStore()
const dialogService = useDialogService()

const toggle = (event: Event) => {
  popover.value.toggle(event)
}
defineExpose({ toggle })

const controlOptions: ControlOption[] = [
  {
    mode: 'randomize',
    icon: 'icon-[lucide--shuffle]',
    title: 'randomize',
    description: 'randomizeDesc'
  },
  {
    mode: 'increment',
    text: '+1',
    title: 'increment',
    description: 'incrementDesc'
  },
  {
    mode: 'decrement',
    text: '-1',
    title: 'decrement',
    description: 'decrementDesc'
  }
]

const widgetControlMode = computed(() =>
  settingStore.get('Comfy.WidgetControlMode')
)

const props = defineProps<{
  controlWidget: () => Ref<ControlOptions>
}>()

const handleToggle = (mode: ControlOptions) => {
  if (props.controlWidget().value === mode) return
  props.controlWidget().value = mode
}

const isActive = (mode: ControlOptions) => {
  return props.controlWidget().value === mode
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
    <div class="w-113 max-w-md p-4 space-y-4">
      <div class="text-sm text-muted-foreground leading-tight">
        {{ $t('widgets.numberControl.header.prefix') }}
        <span class="text-base-foreground font-medium">
          {{
            widgetControlMode === 'before'
              ? $t('widgets.numberControl.header.before')
              : $t('widgets.numberControl.header.after')
          }}
        </span>
        {{ $t('widgets.numberControl.header.postfix') }}
      </div>

      <div class="space-y-2">
        <div
          v-for="option in controlOptions"
          :key="option.mode"
          class="flex items-center justify-between py-2 gap-7"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
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

            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
              <div
                class="text-sm font-normal text-base-foreground leading-tight"
              >
                <span>
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

          <ToggleSwitch
            :model-value="isActive(option.mode)"
            class="flex-shrink-0"
            @update:model-value="
              (v) => (v ? handleToggle(option.mode) : handleToggle('fixed'))
            "
          />
        </div>
      </div>
      <div class="border-t border-border-subtle"></div>
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
