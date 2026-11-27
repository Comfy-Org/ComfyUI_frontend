<template>
  <Button
    class="w-full border-0 bg-input p-2 text-foreground"
    :aria-label="widgetLabel(widgetId)"
    size="sm"
    variant="textonly"
    v-bind="filteredProps"
    @click="handleClick"
  >
    {{ widgetLabel(widgetId) ?? widgetName(widgetId) }}
    <i v-if="options.iconClass" :class="options.iconClass" />
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import {
  widgetLabel,
  widgetLive,
  widgetName,
  widgetOptions
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import { invokeButtonWidgetCallback } from '@/renderer/extensions/vueNodes/widgets/utils/invokeButtonWidgetCallback'
import { useApp } from '@/scripts/appInstance'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import {
  BADGE_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const { widgetId } = defineProps<{
  widgetId: WidgetId
}>()

const options = computed(() => widgetOptions(widgetId))

const BUTTON_EXCLUDED_PROPS = [...BADGE_EXCLUDED_PROPS, 'iconClass'] as const

const filteredProps = computed(() =>
  filterWidgetProps(options.value, BUTTON_EXCLUDED_PROPS)
)

const handleClick = (click: MouseEvent) => {
  const live = widgetLive(widgetId)
  if (!live) return
  invokeButtonWidgetCallback(live.widget, live.node, useApp().canvas, click)
  live.node.widgets?.forEach((w) => w.triggerDraw?.())
}
</script>
