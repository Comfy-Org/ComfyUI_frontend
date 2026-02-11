<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isDOMWidget } from '@/scripts/domWidget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

// Button widgets don't have a v-model value, they trigger actions
const props = defineProps<{
  widget: SimplifiedWidget<void>
  nodeId: string
}>()

const domEl = ref<HTMLElement>()

const canvasStore = useCanvasStore()
const { canvas } = canvasStore

function mountWidgetElement() {
  if (!domEl.value) return
  const node = canvas?.graph?.getNodeById(props.nodeId) ?? undefined
  if (!node) return
  const widget = node.widgets?.find((w) => w.name === props.widget.name)
  if (!widget || !isDOMWidget(widget)) return
  if (domEl.value.contains(widget.element)) return
  domEl.value.replaceChildren(widget.element)
}

onMounted(() => {
  mountWidgetElement()
})

whenever(() => !canvasStore.linearMode, mountWidgetElement)
</script>
<template>
  <div ref="domEl" @pointerdown.stop @pointermove.stop @pointerup.stop />
</template>
