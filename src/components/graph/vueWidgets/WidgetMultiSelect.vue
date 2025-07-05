<template>
  <div class="flex items-center justify-between gap-4">
    <label v-if="widget.name" class="text-xs opacity-80 min-w-[4em] truncate">{{
      widget.name
    }}</label>
    <MultiSelect
      v-model="value"
      v-bind="filteredProps"
      :disabled="readonly"
      class="flex-grow min-w-[8em] max-w-[20em] text-xs"
      :pt="{
        option: 'text-xs'
      }"
    />
  </div>
</template>

<script setup lang="ts">
import MultiSelect from 'primevue/multiselect'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const value = defineModel<any[]>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<any[]>
  readonly?: boolean
}>()

// MultiSelect specific excluded props include overlay styles
const MULTISELECT_EXCLUDED_PROPS = [
  ...PANEL_EXCLUDED_PROPS,
  'overlayStyle'
] as const

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, MULTISELECT_EXCLUDED_PROPS)
)
</script>
