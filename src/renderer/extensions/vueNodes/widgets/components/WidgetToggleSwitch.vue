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

const { widget } = defineProps<{
  widget: SimplifiedWidget<boolean>
}>()

const modelValue = defineModel<boolean>()

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, STANDARD_EXCLUDED_PROPS)
)

const currentLabel = computed(() => {
  const options = widget.options as { on?: string; off?: string }
  return modelValue.value ? options.on : options.off
})
</script>
