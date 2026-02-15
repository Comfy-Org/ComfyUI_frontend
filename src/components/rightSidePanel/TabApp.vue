<script setup lang="ts">
import { useElementBounding, useEventListener } from '@vueuse/core'
import { computed, reactive, toValue } from 'vue'
import type { MaybeRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useHoveredStore } from '@/stores/hoveredStore'

const canvasStore = useCanvasStore()
const hoveredStore = useHoveredStore()
const settingStore = useSettingStore()
const { t } = useI18n()

type BoundStyle = { top: string; left: string; width: string; height: string }
const selectedInputs = reactive<Record<string, MaybeRef<BoundStyle>>>({})
const selectedOutputs = reactive<Record<string, MaybeRef<BoundStyle>>>({})

function hoveredKey() {
  return `Hovered: ${hoveredStore.hoveredNodeId}-${hoveredStore.hoveredWidgetName}`
}

const eventTarget = [
  document.getElementById('graph-canvas')!,
  document.querySelector('[data-testid="transform-pane"]')!
]
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

function elementPosition(e: HTMLElement) {
  const bounding = useElementBounding(e)
  return computed(() => ({
    width: `${bounding.width.value}px`,
    height: `${bounding.height.value}px`,
    left: `${bounding.left.value}px`,
    top: `${bounding.top.value}px`
  }))
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

useEventListener(
  eventTarget,
  'pointerdown',
  (e) => {
    e.preventDefault()
    e.stopPropagation()
  },
  { capture: true }
)
useEventListener(
  eventTarget,
  'pointerup',
  (e) => {
    e.preventDefault()
    e.stopPropagation()
  },
  { capture: true }
)
useEventListener(
  eventTarget,
  'click',
  (e) => {
    e.preventDefault()
    e.stopPropagation()

    const [node, widget] = getHovered() ?? []
    if (!node) return

    if (!widget) {
      const key = `${node.id}: ${node.title}`
      if (!node.constructor.nodeData?.output_node) return
      const bounding = getBounding(node.id)
      if (!(key in selectedOutputs) && bounding) selectedOutputs[key] = bounding
      else delete selectedOutputs[key]
      return
    }

    const key = `${node.id}: ${widget.name}`
    const bounding = getBounding(node.id, widget.name)
    if (!(key in selectedInputs) && bounding) selectedInputs[key] = bounding
    else delete selectedInputs[key]
  },
  { capture: true }
)
</script>
<template>
  <div class="m-4">
    {{
      hoveredStore.hoveredWidgetName ? hoveredKey() : t('[PH]Nothing selected')
    }}
  </div>
  <div class="h-5" />
  {{ t('[PH]Inputs:') }}
  <div v-for="(_, key) in selectedInputs" :key v-text="key" />
  <div class="h-5" />
  {{ t('[PH]Outputs:') }}
  <div v-for="(_, key) in selectedOutputs" :key v-text="key" />

  <Teleport to="body">
    <div class="absolute w-full h-full pointer-events-none">
      <div
        v-for="(style, key) in selectedInputs"
        :key
        :style="toValue(style)"
        class="fixed bg-blue-400/50 rounded-lg"
      />
      <div
        v-for="(style, key) in selectedOutputs"
        :key
        :style="toValue(style)"
        class="fixed bg-orange-400/50 rounded-lg"
      />
    </div>
  </Teleport>
</template>
