<template>
  <WidgetLayoutField :widget="widget">
    <InputText
      v-model="localValue"
      v-bind="filteredProps"
      :class="cn(WidgetInputBaseClass, 'w-full text-xs py-2 px-4')"
      :aria-label="widget.name"
      size="small"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string>
  modelValue: string
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
