<template>
  <div class="flex items-center justify-between gap-4">
    <label v-if="widget.name" class="text-xs opacity-80 min-w-[4em] truncate">{{
      widget.name
    }}</label>
    <InputText
      v-model="localValue"
      v-bind="filteredProps"
      :disabled="readonly"
      class="flex-grow min-w-[8em] max-w-[20em] text-xs"
      @update:model-value="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const props = defineProps<{
  widget: SimplifiedWidget<string>
  modelValue: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useStringWidgetValue(
  props.widget,
  props.modelValue,
  emit
)

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, INPUT_EXCLUDED_PROPS)
)
</script>
