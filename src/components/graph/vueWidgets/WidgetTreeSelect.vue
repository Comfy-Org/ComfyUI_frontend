<template>
  <div class="flex items-center justify-between gap-4">
    <label v-if="widget.name" class="text-xs opacity-80 min-w-[4em] truncate">{{
      widget.name
    }}</label>
    <TreeSelect
      v-model="value"
      v-bind="filteredProps"
      :disabled="readonly"
      class="flex-grow min-w-[8em] max-w-[20em] text-xs"
      size="small"
    />
  </div>
</template>

<script setup lang="ts">
import TreeSelect from 'primevue/treeselect'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const value = defineModel<any>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<any>
  readonly?: boolean
}>()

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
