<template>
  <WidgetLayoutField :widget>
    <Select
      v-model="localValue"
      :options="selectOptions"
      v-bind="combinedProps"
      :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
      :aria-label="widget.name"
      size="small"
      :pt="{
        option: 'text-xs'
      }"
      data-capture-wheel="true"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import { computed } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  modelValue: string | number | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: props.widget.options?.values?.[0] || '',
  emit
})

// Transform compatibility props for overlay positioning
const transformCompatProps = useTransformCompatOverlayProps()

const combinedProps = computed(() => ({
  ...filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS),
  ...transformCompatProps.value
}))

// Extract select options from widget options
const selectOptions = computed(() => {
  const options = props.widget.options

  if (options?.values && Array.isArray(options.values)) {
    return options.values
  }

  return []
})
</script>
