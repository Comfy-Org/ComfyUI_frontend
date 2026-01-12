<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useProtovisCoordinate } from '@/renderer/extensions/vueNodes/widgets/composables/useProtovisCoordinate'
import { isDOMWidget } from '@/scripts/domWidget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

// Button widgets don't have a v-model value, they trigger actions
const props = defineProps<{
  widget: SimplifiedWidget<void>
  nodeId: string
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

  // Apply protovis coordinate fix if this widget uses protovis
  useProtovisCoordinate(domEl.value)
})
</script>
<template>
  <div ref="domEl" @pointerdown.stop @pointermove.stop @pointerup.stop />
</template>
