<template>
  <div class="flex flex-col gap-1">
    <Button
      class="text-base-foreground w-full border-0 bg-component-node-widget-background p-2"
      :aria-label="widget.label"
      size="sm"
      variant="textonly"
      v-bind="filteredProps"
      @click="handleClick"
    >
      {{ widget.label ?? widget.name }}
      <i v-if="widget.options?.iconClass" :class="widget.options.iconClass" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  BADGE_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

// Button widgets don't have a v-model value, they trigger actions
const { widget } = defineProps<{
  widget: SimplifiedWidget<void>
}>()

const BUTTON_EXCLUDED_PROPS = [...BADGE_EXCLUDED_PROPS, 'iconClass'] as const

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, BUTTON_EXCLUDED_PROPS)
)

const handleClick = () => {
  if (widget.callback) {
    widget.callback()
  }
}
</script>
