<template>
  <div class="flex flex-col gap-1">
    <Button
      class="text-base-foreground w-full border-0 bg-component-node-widget-background p-2"
      v-bind="filteredProps"
      :aria-label="widget.label"
      size="small"
      :text="true"
      @click="handleClick"
    >
      {{ widget.label ?? widget.name }}
      <i v-if="widget.options?.iconClass" :class="widget.options.iconClass" />
    </Button>
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
