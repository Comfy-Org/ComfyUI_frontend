<script setup lang="ts">
import { useElementBounding } from '@vueuse/core'
import { computed, reactive, toValue } from 'vue'
import type { MaybeRef } from 'vue'
import { useI18n } from 'vue-i18n'

import DraggableList from '@/components/common/DraggableList.vue'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import TransformPane from '@/renderer/core/layout/transform/TransformPane.vue'
import { useHoveredStore } from '@/stores/hoveredStore'
import { cn } from '@/utils/tailwindUtil'

const canvasInteractions = useCanvasInteractions()
const canvasStore = useCanvasStore()
const hoveredStore = useHoveredStore()
const settingStore = useSettingStore()
const { t } = useI18n()
const canvas: LGraphCanvas = canvasStore.getCanvas()

type BoundStyle = { top: string; left: string; width: string; height: string }
const selectedInputs = reactive<[NodeId, MaybeRef<BoundStyle>][]>([])
const selectedOutputs = reactive<[NodeId, string][]>([])

function getHovered(
  e?: MouseEvent
): undefined | [LGraphNode, undefined] | [LGraphNode, IBaseWidget] {
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
  if (!e) return

  canvas.adjustMouseEvent(e)
  const node = graph.getNodeOnPos(e.canvasX, e.canvasY)
  if (!node) return

  return [node, node.getWidgetOnPos(e.canvasX, e.canvasY, false)]
}

function elementPosition(e: HTMLElement) {
  const bounding = useElementBounding(e)
  return computed(() => ({
    width: `${bounding.width.value / canvas.ds.scale}px`,
    height: `${bounding.height.value / canvas.ds.scale}px`,
    left: `${bounding.left.value / canvas.ds.scale - canvas.ds.offset[0]}px`,
    top: `${bounding.top.value / canvas.ds.scale - canvas.ds.offset[1]}px`
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
  const node = canvas.graph?.getNodeById(nodeId)
  if (!node) return

  if (!widgetName)
    return {
      width: `${node.size[0]}px`,
      height: `${node.size[1] + 30}px`,
      left: `${node.pos[0]}px`,
      top: `${node.pos[1] - 30}px`
    }
  const widget = node.widgets?.find((w) => w.name === widgetName)
  if (!widget) return

  return {
    width: `${node.size[0] - 30}px`,
    height: `${(widget.computedHeight ?? 24) - 4}px`,
    left: `${node.pos[0] + 15}px`,
    top: `${node.pos[1] + widget.y}px`
  }
}

function handleDown(e: MouseEvent) {
  const [node] = getHovered(e) ?? []
  if (!node || e.button > 0) canvasInteractions.forwardEventToCanvas(e)
}
function handleClick(e: MouseEvent) {
  const [node, widget] = getHovered(e) ?? []
  if (!node) return canvasInteractions.forwardEventToCanvas(e)

  if (!widget) {
    const title = `${node.id}: ${node.title}`
    if (!node.constructor.nodeData?.output_node)
      return canvasInteractions.forwardEventToCanvas(e)
    const index = selectedOutputs.findIndex(([id]) => id === node.id)
    if (index === -1) selectedOutputs.push([node.id, title])
    else selectedOutputs.splice(index, 1)
    return
  }

  const key = `${node.id}: ${widget.name}`
  const bounding = getBounding(node.id, widget.name)
  const keyIndex = selectedInputs.findIndex(([k]) => k === key)
  if (keyIndex === -1 && bounding) selectedInputs.push([key, bounding])
  else selectedInputs.splice(keyIndex, 1)
}

function nodeToDisplayTuple(
  n: LGraphNode
): [NodeId, MaybeRef<BoundStyle> | undefined, boolean] {
  return [n.id, getBounding(n.id), selectedOutputs.some(([id]) => n.id === id)]
}

const outputNodes = computed(() =>
  canvas
    .graph!.nodes.filter((n) => n.constructor.nodeData?.output_node)
    .map(nodeToDisplayTuple)
)
</script>
<template>
  <div class="h-5" />
  {{ t('[PH]Inputs:') }}
  <DraggableList v-slot="{ dragClass }" v-model="selectedInputs">
    <div
      v-for="[key] in selectedInputs"
      :key
      :class="cn(dragClass, 'bg-primary-background/30 p-2 my-2 rounded-lg')"
      v-text="key"
    />
  </DraggableList>
  <div class="h-5" />
  {{ t('[PH]Outputs:') }}
  <DraggableList v-slot="{ dragClass }" v-model="selectedOutputs">
    <div
      v-for="([key, title], index) in selectedOutputs"
      :key
      :class="
        cn(
          dragClass,
          'bg-warning-background/40 p-2 my-2 rounded-lg',
          index === 0 && 'ring-warning-background ring-2'
        )
      "
      v-text="title"
    />
  </DraggableList>

  <Teleport to="body">
    <TransformPane
      :class="
        cn(
          'absolute w-full h-full pointer-events-auto!',
          getHovered() ? 'cursor-pointer' : 'cursor-grab'
        )
      "
      :canvas="canvasStore.getCanvas()"
      @pointerdown="handleDown"
      @click="handleClick"
      @wheel="canvasInteractions.forwardEventToCanvas"
    >
      <div
        v-for="[key, style] in selectedInputs"
        :key
        :style="toValue(style)"
        class="fixed bg-primary-background/30 rounded-lg"
      />
      <div
        v-for="[key, style, isSelected] in outputNodes"
        :key
        :style="toValue(style)"
        :class="
          cn(
            'fixed ring-warning-background ring-5 rounded-2xl',
            !isSelected && 'ring-warning-background/50'
          )
        "
      >
        <div class="absolute top-0 right-0 size-8">
          <div
            v-if="isSelected"
            class="absolute -top-1/2 -right-1/2 size-full p-2 bg-warning-background rounded-lg"
          >
            <i class="icon-[lucide--check] bg-text-foreground size-full" />
          </div>
          <div
            v-else
            class="absolute -top-1/2 -right-1/2 size-full ring-warning-background/50 ring-4 ring-inset bg-component-node-background rounded-lg"
          />
        </div>
      </div>
    </TransformPane>
  </Teleport>
</template>
