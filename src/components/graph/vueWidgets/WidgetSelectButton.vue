<template>
  <div class="flex items-center justify-between gap-4">
    <label v-if="widget.name" class="text-xs opacity-80 min-w-[4em] truncate">{{
      widget.name
    }}</label>
    <SelectButton
      v-model="value"
      v-bind="filteredProps"
      :disabled="readonly"
      class="flex-grow min-w-[8em] max-w-[20em] text-xs"
      :pt="{
        pcToggleButton: {
          label: 'text-xs'
        }
      }"
    />
  </div>
</template>

<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const value = defineModel<any>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<any>
  readonly?: boolean
}>()

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
