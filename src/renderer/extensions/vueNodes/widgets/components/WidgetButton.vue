<template>
  <Button
    class="w-full border-0 bg-input p-2 text-foreground"
    :aria-label="widget.label"
    size="sm"
    variant="textonly"
    v-bind="filteredProps"
    @click="handleClick"
  >
    {{ widget.label ?? widget.name }}
    <i v-if="widget.options?.iconClass" :class="widget.options.iconClass" />
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  BADGE_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const props = defineProps<{
  widget: SimplifiedWidget<undefined>
}>()

const BUTTON_EXCLUDED_PROPS = [...BADGE_EXCLUDED_PROPS, 'iconClass'] as const

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, BUTTON_EXCLUDED_PROPS)
)

const handleClick = (click: MouseEvent) => {
  props.widget.callback?.(undefined, click)
}
</script>
