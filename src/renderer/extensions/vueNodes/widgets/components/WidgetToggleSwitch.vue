<template>
  <WidgetLayoutField :widget="widget">
    <ToggleSwitch
      v-model="localValue"
      v-bind="filteredProps"
      :aria-label="widget.name"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'

import { useBooleanWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<boolean>
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useBooleanWidgetValue(
  props.widget,
  props.modelValue,
  emit
)

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
)
</script>

<style scoped>
:deep(.p-toggleswitch .p-toggleswitch-slider) {
  border: 1px solid transparent;
}

:deep(.p-toggleswitch:hover .p-toggleswitch-slider) {
  border-color: currentColor;
}
</style>
