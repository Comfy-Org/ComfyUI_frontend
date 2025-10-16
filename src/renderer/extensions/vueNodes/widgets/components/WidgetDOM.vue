<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isDOMWidget } from '@/scripts/domWidget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

// Button widgets don't have a v-model value, they trigger actions
const props = defineProps<{
  widget: SimplifiedWidget<void>
  nodeId: string
  readonly?: boolean
}>()

const domEl = ref<HTMLElement>()

const { canvas } = useCanvasStore()
onMounted(() => {
  if (!domEl.value) return
  const node = canvas?.graph?.getNodeById(props.nodeId) ?? undefined
  if (!node) return
  const widget = node.widgets?.find((w) => w.name === props.widget.name)
  if (!widget || !isDOMWidget(widget)) return
  domEl.value.replaceChildren(widget.element)
})
</script>
<template>
  <div ref="domEl" />
</template>
