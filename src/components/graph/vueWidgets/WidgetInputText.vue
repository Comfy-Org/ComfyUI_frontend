<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <InputText
      v-model="localValue"
      v-bind="filteredProps"
      :disabled="readonly"
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
