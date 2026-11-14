<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { DOMWidget } from '@/types/domWidget'
import { isDOMWidget } from '@/scripts/domWidget'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'
import { useWidgetHostNode } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetHostNode'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<undefined>
  nodeId: NodeId
}>()

const domEl = ref<HTMLElement>()

const owner = useWidgetHostNode(
  () => props.widget.hostNodeLocatorId,
  () => props.nodeId
)
const canvasStore = useCanvasStore()

function findDOMWidget(): DOMWidget<HTMLElement, object | string> | undefined {
  const resolved = resolveWidgetFromHostNode(owner.value, props.widget.name)
  if (resolved && isDOMWidget(resolved.widget)) return resolved.widget

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
watch(owner, mountWidgetElement, { flush: 'post' })
</script>
<template>
  <div
    ref="domEl"
    class="flex flex-col *:flex-1"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  />
</template>
