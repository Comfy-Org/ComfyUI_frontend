<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <Select
      v-model="localValue"
      :options="selectOptions"
      v-bind="filteredProps"
      :disabled="readonly"
      @update:model-value="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'
import { useWidgetValue } from '@/composables/graph/useWidgetValue'

const props = defineProps<{
  widget: SimplifiedWidget<any>
  modelValue: any
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: props.widget.options?.values?.[0] || '',
  emit
})

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS)
)

// Extract select options from widget options
const selectOptions = computed(() => {
  const options = props.widget.options

  if (options?.values && Array.isArray(options.values)) {
    return options.values
  }

  return []
})
</script>
