<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <ToggleSwitch
      v-model="value"
      v-bind="filteredProps"
      :disabled="readonly"
      :pt="{
        root: {
          class:
            'hover:outline hover:outline-1 hover:outline-[#5B5E7D] rounded-full'
        },
        slider: ({ props }) => ({
          style: {
            backgroundColor: props.modelValue ? '#0b8ce9' : '#0e0e12'
          }
        }),
        handle: ({ props }) => ({
          style: {
            backgroundColor: props.modelValue ? '#ffffff' : '#5b5e7d'
          }
        })
      }"
    />
  </div>
</template>

<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import type { WidgetToggleSwitchProps } from '@/types/widgetPropTypes'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const value = defineModel<boolean>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<boolean, WidgetToggleSwitchProps>
  readonly?: boolean
}>()

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, INPUT_EXCLUDED_PROPS)
)
</script>
