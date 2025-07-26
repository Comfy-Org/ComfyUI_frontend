<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <TreeSelect v-model="value" v-bind="filteredProps" :disabled="readonly" />
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
