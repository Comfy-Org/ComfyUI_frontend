<template>
  <div class="flex flex-col gap-1">
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'
import { useApp } from '@/scripts/appInstance'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import {
  BADGE_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const { widgetId } = defineProps<{
  widgetId: WidgetId
}>()

const widget = useWidgetView(() => widgetId)

const BUTTON_EXCLUDED_PROPS = [...BADGE_EXCLUDED_PROPS, 'iconClass'] as const

const filteredProps = computed(() =>
  filterWidgetProps(widget.value.options, BUTTON_EXCLUDED_PROPS)
)

const handleClick = () => {
  const live = widget.value.live
  live?.widget.callback?.(live.widget.value, useApp().canvas, live.node)
}
</script>
