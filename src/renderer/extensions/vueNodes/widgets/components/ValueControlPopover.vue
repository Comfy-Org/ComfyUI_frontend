<script setup lang="ts">
import Popover from 'primevue/popover'
import RadioButton from 'primevue/radiobutton'
import { computed, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
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

const toggle = (event: Event) => {
  popover.value.toggle(event)
}
defineExpose({ toggle })

const controlOptions: ControlOption[] = [
  {
    mode: 'fixed',
    icon: 'icon-[lucide--pencil-off]',
    title: 'fixed',
    description: 'fixedDesc'
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
  },
  {
    mode: 'randomize',
    icon: 'icon-[lucide--shuffle]',
    title: 'randomize',
    description: 'randomizeDesc'
  }
]

const widgetControlMode = computed(() =>
  settingStore.get('Comfy.WidgetControlMode')
)

const controlMode = defineModel<ControlOptions>()
</script>

<template>
  <Popover
    ref="popover"
    class="rounded-lg border border-interface-stroke bg-interface-panel-surface"
  >
    <div class="w-113 max-w-md space-y-4 p-4">
      <div class="text-sm leading-tight text-muted-foreground">
        {{ $t('widgets.valueControl.header.prefix') }}
        <span class="font-medium text-base-foreground">
          {{
            widgetControlMode === 'before'
              ? $t('widgets.valueControl.header.before')
              : $t('widgets.valueControl.header.after')
          }}
        </span>
        {{ $t('widgets.valueControl.header.postfix') }}
      </div>

      <div class="space-y-2">
        <div
          v-for="option in controlOptions"
          :key="option.mode"
          class="flex items-center justify-between gap-7 py-2"
        >
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <div
              class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-secondary-background"
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

            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <div
                class="text-sm leading-tight font-normal text-base-foreground"
              >
                <span>
                  {{ $t(`widgets.valueControl.${option.title}`) }}
                </span>
              </div>
              <div
                class="text-sm leading-tight font-normal text-muted-foreground"
              >
                {{ $t(`widgets.valueControl.${option.description}`) }}
              </div>
            </div>
          </div>

          <RadioButton
            v-model="controlMode"
            class="flex-shrink-0"
            :input-id="option.mode"
            :value="option.mode"
          />
        </div>
      </div>
    </div>
  </Popover>
</template>
