<template>
  <div class="flex items-center justify-between gap-2">
    <label v-if="widget.name" class="text-xs opacity-80 min-w-[4em] truncate">{{
      widget.name
    }}</label>
    <Slider
      v-model="localValue"
      v-bind="filteredProps"
      :disabled="readonly"
      class="flex-grow min-w-[8em] max-w-[20em] text-xs"
      @update:model-value="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import Slider from 'primevue/slider'
import { computed } from 'vue'

import { useNumberWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const props = defineProps<{
  widget: SimplifiedWidget<number>
  modelValue: number
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useNumberWidgetValue(
  props.widget,
  props.modelValue,
  emit
)

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
)
</script>
