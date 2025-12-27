<template>
  <WidgetLayoutField :widget>
    <div v-if="currentLabel" class="ml-auto flex items-center gap-2">
      <ToggleSwitch
        v-model="modelValue"
        v-bind="filteredProps"
        :aria-label="widget.name"
      />
      <span class="text-sm">{{ currentLabel }}</span>
    </div>
    <ToggleSwitch
      v-else
      v-model="modelValue"
      v-bind="filteredProps"
      class="ml-auto block"
      :aria-label="widget.name"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

interface BooleanWidgetOptions {
  on?: string
  off?: string
  [key: string]: any
}

const { widget } = defineProps<{
  widget: SimplifiedWidget<boolean, BooleanWidgetOptions>
}>()

const modelValue = defineModel<boolean>()

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, STANDARD_EXCLUDED_PROPS)
)

const currentLabel = computed(() => {
  return modelValue.value ? widget.options?.on : widget.options?.off
})
</script>
