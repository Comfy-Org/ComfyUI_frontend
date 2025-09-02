<template>
  <WidgetLayoutField :widget="widget">
    <FormSelectButton
      v-model="localValue"
      :options="filteredProps.values || filteredProps.options || []"
      :disabled="readonly"
      class="w-full"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import FormSelectButton from './form/FormSelectButton.vue'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

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

const filteredProps = computed(() => {
  const filtered = filterWidgetProps(
    props.widget.options,
    STANDARD_EXCLUDED_PROPS
  )

  // Ensure options array is available for SelectButton
  if (filtered.values && Array.isArray(filtered.values)) {
    filtered.options = filtered.values
  }

  return filtered
})
</script>
