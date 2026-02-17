<script setup lang="ts">
import { computed, reactive, ref, toValue } from 'vue'
import type { MaybeRef } from 'vue'
import { useI18n } from 'vue-i18n'

import DraggableList from '@/components/common/DraggableList.vue'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useHoveredStore } from '@/stores/hoveredStore'
import { cn } from '@/utils/tailwindUtil'

const canvasInteractions = useCanvasInteractions()
const canvasStore = useCanvasStore()
const hoveredStore = useHoveredStore()
const settingStore = useSettingStore()
const { t } = useI18n()

type BoundStyle = { top: string; left: string; width: string; height: string }
const selectedInputs = reactive<[string, MaybeRef<BoundStyle>][]>([])
const selectedOutputs = reactive<[string, MaybeRef<BoundStyle>][]>([])

function hoveredKey() {
  return `Hovered: ${hoveredStore.hoveredNodeId}-${hoveredStore.hoveredWidgetName}`
}

function getHovered():
  | undefined
  | [LGraphNode, undefined]
  | [LGraphNode, IBaseWidget] {
  const canvas = canvasStore.getCanvas()
  const { graph } = canvas
  if (!canvas || !graph) return

  if (settingStore.get('Comfy.VueNodes.Enabled')) {
    const node = graph.getNodeById(hoveredStore.hoveredNodeId)
    if (!node) return

    const widget = node.widgets?.find(
      (w) => w.name === hoveredStore.hoveredWidgetName
    )
    return [node, widget]
  }
  const [x, y] = canvas.graph_mouse
  const node = graph.getNodeOnPos(x, y, graph.nodes)
  if (!node) return

  return [node, node.getWidgetOnPos(x, y, false)]
}

//FIXME: unregistration :(
const updateDisp = ref(0)
const { ds } = canvasStore.getCanvas()
ds.onChanged = useChainCallback(ds.onChanged, () =>
  requestAnimationFrame(() => updateDisp.value++)
)

function elementPosition(e: HTMLElement) {
  return computed(() => {
    void updateDisp.value
    const bounding = e.getBoundingClientRect()
    return {
      width: `${bounding.width}px`,
      height: `${bounding.height}px`,
      left: `${bounding.left}px`,
      top: `${bounding.top}px`
    }
  })
}
function getBounding(nodeId: NodeId, widgetName?: string) {
  if (settingStore.get('Comfy.VueNodes.Enabled')) {
    const element = document.querySelector(
      widgetName
        ? `[data-node-id="${nodeId}"] [data-widget-name="${widgetName}"`
        : `[data-node-id="${nodeId}"]`
    )
    return element instanceof HTMLElement ? elementPosition(element) : undefined
  }
}

function handleDown(e: PointerEvent) {
  const [node, widget] = getHovered() ?? []
  if (!node) return canvasInteractions.forwardEventToCanvas(e)

  if (!widget) {
    const key = `${node.id}: ${node.title}`
    if (!node.constructor.nodeData?.output_node)
      return canvasInteractions.forwardEventToCanvas(e)
    const bounding = getBounding(node.id)
    const keyIndex = selectedOutputs.findIndex(([k]) => k === key)
    if (keyIndex === -1 && bounding) selectedOutputs.push([key, bounding])
    else selectedOutputs.splice(keyIndex, 1)
    return
  }

  const key = `${node.id}: ${widget.name}`
  const bounding = getBounding(node.id, widget.name)
  const keyIndex = selectedInputs.findIndex(([k]) => k === key)
  if (keyIndex === -1 && bounding) selectedInputs.push([key, bounding])
  else selectedInputs.splice(keyIndex, 1)
}
</script>
<template>
  <div class="m-4">
    {{
      hoveredStore.hoveredWidgetName ? hoveredKey() : t('[PH]Nothing selected')
    }}
  </div>
  <div class="h-5" />
  {{ t('[PH]Inputs:') }}
  <DraggableList v-slot="{ dragClass }" v-model="selectedInputs">
    <div
      v-for="[key] in selectedInputs"
      :key
      :class="cn(dragClass, 'bg-blue-400/20 p-2 rounded-lg')"
      v-text="key"
    />
  </DraggableList>
  <div class="h-5" />
  {{ t('[PH]Outputs:') }}
  <DraggableList v-slot="{ dragClass }" v-model="selectedOutputs">
    <div
      v-for="[key] in selectedOutputs"
      :key
      :class="cn(dragClass, 'bg-orange-400/20 p-2 rounded-lg')"
      v-text="key"
    />
  </DraggableList>

  <Teleport to="body">
    <div
      class="absolute w-full h-full"
      @pointerdown="handleDown"
      @pointerup="canvasInteractions.forwardEventToCanvas"
      @pointermove="canvasInteractions.forwardEventToCanvas"
    >
      <div
        v-for="[key, style] in selectedInputs"
        :key
        :style="toValue(style)"
        class="fixed bg-blue-400/50 rounded-lg"
      />
      <div
        v-for="[key, style] in selectedOutputs"
        :key
        :style="toValue(style)"
        class="fixed bg-orange-400/50 rounded-2xl"
      >
        <div
          class="absolute top-0 right-0 bg-red-400"
          :style="{
            width: 0.2 * canvasStore.appScalePercentage + 'px',
            height: 0.2 * canvasStore.appScalePercentage + 'px'
          }"
        />
      </div>
    </div>
  </Teleport>
</template>
