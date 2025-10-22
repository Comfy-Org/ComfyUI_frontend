<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-secondary text-sm">{{
      widget.name
    }}</label>
    <Button
      v-bind="filteredProps"
      :aria-label="widget.name || widget.label"
      size="small"
      @click="handleClick"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  BADGE_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

// Button widgets don't have a v-model value, they trigger actions
const props = defineProps<{
  widget: SimplifiedWidget<void>
}>()

// Button specific excluded props
const BUTTON_EXCLUDED_PROPS = [...BADGE_EXCLUDED_PROPS, 'iconClass'] as const

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, BUTTON_EXCLUDED_PROPS)
)

const handleClick = () => {
  if (props.widget.callback) {
    props.widget.callback()
  }
}
</script>
