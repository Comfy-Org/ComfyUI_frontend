<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

type ControlSettings = {
  linkToGlobal: boolean
  randomize: boolean
  increment: boolean
  decrement: boolean
}

type ControlOption = {
  key: keyof ControlSettings
  icon?: string
  title: string
  description: string
  text?: string
}

const popover = ref()
const settingStore = useSettingStore()

const toggle = (event: Event) => {
  popover.value.toggle(event)
}
defineExpose({ toggle })

const controlOptions: ControlOption[] = [
  {
    key: 'linkToGlobal',
    icon: 'pi pi-link',
    title: 'linkToGlobal',
    description: 'linkToGlobalDesc'
  },
  {
    key: 'randomize',
    icon: 'icon-[lucide--shuffle]',
    title: 'randomize',
    description: 'randomizeDesc'
  },
  {
    key: 'increment',
    text: '+1',
    title: 'increment',
    description: 'incrementDesc'
  },
  {
    key: 'decrement',
    text: '-1',
    title: 'decrement',
    description: 'decrementDesc'
  }
]

const widgetControlMode = computed(() =>
  settingStore.get('Comfy.WidgetControlMode')
)

const controlSettings = ref<ControlSettings>({
  linkToGlobal: false,
  randomize: true,
  increment: false,
  decrement: false
})

const handleToggle = (key: keyof ControlSettings) => {
  // If turning on, turn off all others first
  if (!controlSettings.value[key]) {
    controlSettings.value = {
      linkToGlobal: false,
      randomize: false,
      increment: false,
      decrement: false
    }
  }
  // Toggle the clicked one
  controlSettings.value[key] = !controlSettings.value[key]
}
</script>

<template>
  <Popover ref="popover">
    <div class="w-105 p-4 space-y-4">
      <p class="text-sm text-slate-100">
        {{ $t('widgets.seed.controlHeaderBefore') }}
        <span class="text-white">
          {{
            widgetControlMode === 'before'
              ? $t('widgets.seed.controlHeaderBefore2')
              : $t('widgets.seed.controlHeaderAfter')
          }}
        </span>
        {{ $t('widgets.seed.controlHeaderEnd') }}
      </p>

      <div class="space-y-2">
        <div
          v-for="option in controlOptions"
          :key="option.key"
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
                <span v-if="option.key === 'linkToGlobal'">
                  {{ $t('widgets.seed.linkToGlobal') }}
                  <em>{{ $t('widgets.seed.linkToGlobalSeed') }}</em>
                </span>
                <span v-else>
                  {{ $t(`widgets.seed.${option.title}`) }}
                </span>
              </div>
              <div class="text-sm font-normal text-slate-100">
                {{ $t(`widgets.seed.${option.description}`) }}
              </div>
            </div>
          </div>
          <ToggleSwitch
            :model-value="controlSettings[option.key]"
            class="flex-shrink-0"
            @update:model-value="handleToggle(option.key)"
          />
        </div>
      </div>

      <hr class="border-charcoal-400 border-1" />

      <Button severity="secondary" size="small" class="w-full">
        <i class="pi pi-cog mr-2 text-xs" />
        {{ $t('widgets.seed.editSettings') }}
      </Button>
    </div>
  </Popover>
</template>
