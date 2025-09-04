<template>
  <WidgetLayoutField :widget="widget">
    <MultiSelect
      v-model="localValue"
      v-bind="filteredProps"
      :disabled="readonly"
      :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
      size="small"
      display="chip"
      :pt="{
        option: 'text-xs'
      }"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import MultiSelect from 'primevue/multiselect'
import { computed } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<any[]>
  modelValue: any[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any[]]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: [],
  emit
})

// MultiSelect specific excluded props include overlay styles
const MULTISELECT_EXCLUDED_PROPS = [
  ...PANEL_EXCLUDED_PROPS,
  'overlayStyle'
] as const

const filteredProps = computed(() => {
  const filtered = filterWidgetProps(
    props.widget.options,
    MULTISELECT_EXCLUDED_PROPS
  )

  // Ensure options array is available for MultiSelect
  const values = props.widget.options?.values
  if (values && Array.isArray(values)) {
    filtered.options = values
  }

  return filtered
})
</script>
