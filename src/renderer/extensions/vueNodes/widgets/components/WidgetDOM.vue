<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { DOMWidget } from '@/scripts/domWidget'
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

function findDOMWidget(): DOMWidget<HTMLElement, object | string> | undefined {
  const node = canvas?.graph?.getNodeById(props.nodeId) ?? undefined
  if (!node) return undefined
  const widget = node.widgets?.find((w) => w.name === props.widget.name)
  if (!widget) return undefined

  // Direct DOM widget on the node
  if (isDOMWidget(widget)) return widget

  // Promoted DOM widget: resolve through subgraph to interior widget
  if (isPromotedWidgetView(widget) && node.isSubgraphNode()) {
    const innerNode = node.subgraph.getNodeById(widget.sourceNodeId)
    const innerWidget = innerNode?.widgets?.find(
      (w) => w.name === widget.sourceWidgetName
    )
    if (innerWidget && isDOMWidget(innerWidget)) return innerWidget
  }

  return undefined
}

function mountWidgetElement() {
  if (!domEl.value) return
  const widget = findDOMWidget()
  if (!widget) return
  if (domEl.value.contains(widget.element)) return
  domEl.value.replaceChildren(widget.element)
}

onMounted(() => {
  mountWidgetElement()
})

whenever(() => !canvasStore.linearMode, mountWidgetElement)
</script>
<template>
  <div
    ref="domEl"
    class="flex flex-col [&>*]:flex-1"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  />
</template>
