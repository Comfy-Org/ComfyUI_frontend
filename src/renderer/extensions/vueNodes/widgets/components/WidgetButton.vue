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
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWidgetHostNode } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetHostNode'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  BADGE_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<undefined>
  nodeId: NodeId
}>()

const BUTTON_EXCLUDED_PROPS = [...BADGE_EXCLUDED_PROPS, 'iconClass'] as const

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, BUTTON_EXCLUDED_PROPS)
)

const canvasStore = useCanvasStore()
const hostNode = useWidgetHostNode(() => nodeId)

function asPointerEventForBrowsersWithMouseEventClicks(e: MouseEvent) {
  return e instanceof PointerEvent ? e : new PointerEvent(e.type, e)
}

function toGraphPointerEvent(
  click: MouseEvent,
  canvas: LGraphCanvas
): CanvasPointerEvent {
  const e = asPointerEventForBrowsersWithMouseEventClicks(click)
  canvas.adjustMouseEvent(e)
  canvas.graph_mouse[0] = e.canvasX
  canvas.graph_mouse[1] = e.canvasY
  return e
}

function handleClick(click: MouseEvent) {
  const canvas = canvasStore.canvas
  const live = resolveWidgetFromHostNode(hostNode.value, widget.name)
  if (!canvas || !live) return
  toConcreteWidget(live.widget, live.node, false)?.onClick({
    e: toGraphPointerEvent(click, canvas),
    node: live.node,
    canvas
  })
}
</script>
