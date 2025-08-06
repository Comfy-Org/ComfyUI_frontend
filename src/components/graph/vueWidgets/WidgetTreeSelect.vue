<template>
  <div class="flex items-center justify-between gap-4">
    <label v-if="widget.name" class="text-xs opacity-80 min-w-[4em] truncate">{{
      widget.name
    }}</label>
    <TreeSelect
      v-model="localValue"
      v-bind="filteredProps"
      :disabled="readonly"
      class="flex-grow min-w-[8em] max-w-[20em] text-xs"
      size="small"
      @update:model-value="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import TreeSelect from 'primevue/treeselect'
import { computed } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

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
