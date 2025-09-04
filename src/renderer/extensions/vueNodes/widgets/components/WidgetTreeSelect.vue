<template>
  <WidgetLayoutField :widget="widget">
    <TreeSelect
      v-model="localValue"
      v-bind="filteredProps"
      :disabled="readonly"
      :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
      size="small"
      @update:model-value="onChange"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import TreeSelect from 'primevue/treeselect'
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

// TreeSelect specific excluded props
const TREE_SELECT_EXCLUDED_PROPS = [
  ...PANEL_EXCLUDED_PROPS,
  'inputClass',
  'inputStyle'
] as const

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, TREE_SELECT_EXCLUDED_PROPS)
)
</script>
