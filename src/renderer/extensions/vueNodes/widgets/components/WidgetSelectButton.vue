<template>
  <WidgetLayoutField :widget="widget">
    <SelectButton
      v-model="localValue"
      v-bind="filteredProps"
      :disabled="readonly"
      class="w-full text-xs"
      :pt="{
        pcToggleButton: {
          label: 'text-xs'
        }
      }"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<any>
  modelValue: any
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  modelValue: props.modelValue,
  defaultValue: null,
  emit
})

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
)
</script>

<style scoped>
:deep(.p-selectbutton) {
  border: 1px solid transparent;
}

:deep(.p-selectbutton:hover) {
  border-color: currentColor;
}
</style>
