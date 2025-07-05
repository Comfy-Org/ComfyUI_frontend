<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <SelectButton v-model="value" v-bind="filteredProps" :disabled="readonly" />
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
