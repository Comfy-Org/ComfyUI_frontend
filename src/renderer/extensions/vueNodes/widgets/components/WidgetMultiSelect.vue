<template>
  <WidgetLayoutField :widget="widget">
    <MultiSelect
      v-model="localValue"
      :options="multiSelectOptions"
      v-bind="combinedProps"
      class="w-full text-xs"
      :aria-label="widget.name"
      size="small"
      display="chip"
      :pt="{
        option: 'text-xs'
      }"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts" generic="T extends WidgetValue = WidgetValue">
import MultiSelect from 'primevue/multiselect'
import { computed } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<T[]>
  modelValue: T[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T[]]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useWidgetValue<T[]>({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: [],
  emit
})

// Transform compatibility props for overlay positioning
const transformCompatProps = useTransformCompatOverlayProps()

// MultiSelect specific excluded props include overlay styles
const MULTISELECT_EXCLUDED_PROPS = [
  ...PANEL_EXCLUDED_PROPS,
  'overlayStyle'
] as const

const combinedProps = computed(() => ({
  ...filterWidgetProps(props.widget.options, MULTISELECT_EXCLUDED_PROPS),
  ...transformCompatProps.value
}))

// Extract multiselect options from widget options
const multiSelectOptions = computed((): T[] => {
  const options = props.widget.options

  if (Array.isArray(options?.values)) {
    return options.values
  }

  return []
})
</script>
