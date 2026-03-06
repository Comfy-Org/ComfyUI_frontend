<script setup lang="ts">
import RadioButton from 'primevue/radiobutton'
import Button from '@/components/ui/button/Button.vue'
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { ControlOptions } from '@/types/simplifiedWidget'

type ControlOption = {
  description: string
  mode: ControlOptions
  icon?: string
  text?: string
  title: string
}

const settingStore = useSettingStore()

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
  <div class="w-113 max-w-md space-y-4 p-4">
    <div class="text-sm/tight text-muted-foreground">
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
      <Button
        v-for="option in controlOptions"
        :key="option.mode"
        as="label"
        variant="textonly"
        size="lg"
        class="flex h-[unset] w-full items-center justify-between gap-7 py-2 text-left"
        :for="option.mode"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 text-wrap">
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-secondary-background"
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
            <div class="text-sm/tight font-normal text-base-foreground">
              <span>
                {{ $t(`widgets.valueControl.${option.title}`) }}
              </span>
            </div>
            <div class="text-sm/tight font-normal text-muted-foreground">
              {{ $t(`widgets.valueControl.${option.description}`) }}
            </div>
          </div>
        </div>

        <RadioButton
          v-model="controlMode"
          class="shrink"
          :input-id="option.mode"
          :value="option.mode"
        />
      </Button>
    </div>
  </div>
</template>
