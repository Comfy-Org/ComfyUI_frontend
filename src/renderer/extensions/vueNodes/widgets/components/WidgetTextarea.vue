<template>
  <Textarea
    v-model="localValue"
    v-bind="filteredProps"
    :disabled="readonly"
    :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
    :placeholder="placeholder || widget.name || ''"
    size="small"
    rows="3"
    @update:model-value="onChange"
  />
</template>

<script setup lang="ts">
import Textarea from 'primevue/textarea'
import { computed } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'

const props = defineProps<{
  widget: SimplifiedWidget<string>
  modelValue: string
  readonly?: boolean
  placeholder?: string
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
