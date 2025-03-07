<template>
  <div ref="widgetElement" :style="style" />
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { computed, onMounted, ref, watch } from 'vue'

import { useAbsolutePosition } from '@/composables/element/useAbsolutePosition'
import { useDomClipping } from '@/composables/element/useDomClipping'
import type { DOMWidget } from '@/scripts/domWidget'
import { DomWidgetState } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'

const { widget, widgetState } = defineProps<{
  widget: DOMWidget<HTMLElement, any>
  widgetState: DomWidgetState
}>()

const widgetElement = ref<HTMLElement>()

const { style: positionStyle, updatePositionWithTransform } =
  useAbsolutePosition()
const { style: clippingStyle, updateClipPath } = useDomClipping()
const style = computed(() => ({
  ...positionStyle.value,
  ...clippingStyle.value
}))

const canvasStore = useCanvasStore()
watch(widgetState, (newState) => {
  updatePositionWithTransform(newState)

  const lgCanvas = canvasStore.canvas
  const selectedNode = Object.values(
    lgCanvas.selected_nodes ?? {}
  )[0] as LGraphNode
  const node = widget.node
  const isSelected = selectedNode === node

  const renderArea = node.renderArea
  const offset = lgCanvas.ds.offset
  const scale = lgCanvas.ds.scale

  updateClipPath(widgetElement.value, lgCanvas.canvas, isSelected, {
    x: renderArea[0],
    y: renderArea[1],
    width: renderArea[2],
    height: renderArea[3],
    scale,
    offset: [offset[0], offset[1]]
  })
})

onMounted(() => {
  widgetElement.value.appendChild(widget.element)
})
</script>
