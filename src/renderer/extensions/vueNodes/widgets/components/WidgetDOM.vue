<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isDOMWidget } from '@/scripts/domWidget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<void>
  nodeId: string
}>()

const domEl = ref<HTMLElement>()

const { canvas } = useCanvasStore()
onMounted(() => {
  if (!domEl.value) return
  const node = canvas?.graph?.getNodeById(nodeId) ?? undefined
  if (!node) return
  const matchedWidget = node.widgets?.find((w) => w.name === widget.name)
  if (!matchedWidget || !isDOMWidget(matchedWidget)) return
  domEl.value.replaceChildren(matchedWidget.element)
})
</script>
<template>
  <div ref="domEl" @pointerdown.stop @pointermove.stop @pointerup.stop />
</template>
