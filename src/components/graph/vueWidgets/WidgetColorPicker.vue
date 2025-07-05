<!-- Needs custom color picker for alpha support -->
<template>
  <div class="flex items-center justify-between">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <ColorPicker
      v-model="value"
      v-bind="filteredProps"
      :disabled="readonly"
      inline
    />
  </div>
</template>

<script setup lang="ts">
import ColorPicker from 'primevue/colorpicker'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const value = defineModel<string>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<string>
  readonly?: boolean
}>()

// ColorPicker specific excluded props include panel/overlay classes
const COLOR_PICKER_EXCLUDED_PROPS = [...PANEL_EXCLUDED_PROPS] as const

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, COLOR_PICKER_EXCLUDED_PROPS)
)
</script>
