<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isDOMWidget } from '@/scripts/domWidget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<void>
  nodeId: string
}>()

const domEl = ref<HTMLElement>()

const canvasStore = useCanvasStore()
const { canvas } = canvasStore

function mountWidgetElement() {
  if (!domEl.value) return
  const node = canvas?.graph?.getNodeById(nodeId) ?? undefined
  if (!node) return
  const matchedWidget = node.widgets?.find((w) => w.name === widget.name)
  if (!matchedWidget || !isDOMWidget(matchedWidget)) return
  if (domEl.value.contains(matchedWidget.element)) return
  domEl.value.replaceChildren(matchedWidget.element)
}

onMounted(() => {
  mountWidgetElement()
})

whenever(() => !canvasStore.linearMode, mountWidgetElement)
</script>
<template>
  <div ref="domEl" @pointerdown.stop @pointermove.stop @pointerup.stop />
</template>
