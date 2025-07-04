<template>
  <div class="flex items-center justify-between">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <Slider
      v-model="localValue"
      v-bind="filteredProps"
      :disabled="readonly"
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
