<script setup lang="ts">
import { computed } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'
import { isComponentWidget } from '@/scripts/domWidget'
import type { ComponentWidget } from '@/scripts/domWidget'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<WidgetValue>
  nodeId: string
}>()

const modelValue = defineModel<WidgetValue>()

const canvasStore = useCanvasStore()

const componentWidget = computed<ComponentWidget<object | string> | undefined>(
  () => {
    const hostNode =
      canvasStore.canvas?.graph?.getNodeById(props.nodeId) ?? undefined
    const resolved = resolveWidgetFromHostNode(hostNode, props.widget.name)
    if (resolved && isComponentWidget(resolved.widget)) return resolved.widget
    return undefined
  }
)
</script>

<template>
  <component
    :is="componentWidget.component"
    v-if="componentWidget"
    v-model="modelValue"
    :widget="componentWidget"
  />
</template>
