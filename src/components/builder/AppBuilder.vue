<script setup lang="ts">
/**
 * AppBuilder — graph-canvas click-to-select overlay for the builder's
 * inputs/outputs steps. The panel UI (accordion lists, arrange draggable
 * list) lives in BuilderPanel.vue; this component now only renders the
 * full-screen Teleport that sits over the graph canvas and routes widget
 * / output-node clicks into appModeStore.
 *
 * Gated on `isSelectMode` (only inputs + outputs) and skipped when Vue
 * nodes are enabled — Vue nodes handle their own click selection.
 */
import { remove } from 'es-toolkit'
import { computed, ref, toValue } from 'vue'
import type { MaybeRef } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraphEventMode,
  TitleMode
} from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import TransformPane from '@/renderer/core/layout/transform/TransformPane.vue'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import { nodeTypeValidForApp, useAppModeStore } from '@/stores/appModeStore'
import { resolveNodeWidget } from '@/utils/litegraphUtil'
import { cn } from '@comfyorg/tailwind-utils'

type BoundStyle = { top: string; left: string; width: string; height: string }

const appModeStore = useAppModeStore()
const canvasInteractions = useCanvasInteractions()
const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()
const canvas: LGraphCanvas = canvasStore.getCanvas()

const { isSelectMode, isSelectInputsMode, isSelectOutputsMode } = useAppMode()
const hoveringSelectable = ref(false)

workflowStore.activeWorkflow?.changeTracker?.reset()

function getHovered(
  e: MouseEvent
): undefined | [LGraphNode, undefined] | [LGraphNode, IBaseWidget] {
  const { graph } = canvas
  if (!canvas || !graph) return

  if (settingStore.get('Comfy.VueNodes.Enabled')) return undefined
  if (!e) return

  canvas.adjustMouseEvent(e)
  const node = graph.getNodeOnPos(e.canvasX, e.canvasY)
  if (!node) return

  const widget = node.getWidgetOnPos(e.canvasX, e.canvasY, false)

  if (widget || node.constructor.nodeData?.output_node) return [node, widget]
}

function getBounding(nodeId: NodeId, widgetName?: string) {
  if (settingStore.get('Comfy.VueNodes.Enabled')) return undefined
  const [node, widget] = resolveNodeWidget(nodeId, widgetName)
  if (!node) return

  const titleOffset =
    node.title_mode === TitleMode.NORMAL_TITLE ? LiteGraph.NODE_TITLE_HEIGHT : 0

  if (!widgetName)
    return {
      width: `${node.size[0]}px`,
      height: `${node.size[1] + titleOffset}px`,
      left: `${node.pos[0]}px`,
      top: `${node.pos[1] - titleOffset}px`
    }
  if (!widget) return

  const margin = widget instanceof DOMWidgetImpl ? widget.margin : undefined
  const marginX = margin ?? BaseWidget.margin
  const height =
    (widget.computedHeight !== undefined
      ? widget.computedHeight - 4
      : LiteGraph.NODE_WIDGET_HEIGHT) - (margin ? 2 * margin - 4 : 0)
  return {
    width: `${node.size[0] - marginX * 2}px`,
    height: `${height}px`,
    left: `${node.pos[0] + marginX}px`,
    top: `${node.pos[1] + widget.y + (margin ?? 0)}px`
  }
}

function handleDown(e: MouseEvent) {
  const [node] = getHovered(e) ?? []
  if (!node || e.button > 0) canvasInteractions.forwardEventToCanvas(e)
}
function handleClick(e: MouseEvent) {
  const [node, widget] = getHovered(e) ?? []
  if (
    node?.mode !== LGraphEventMode.ALWAYS ||
    !nodeTypeValidForApp(node.type) ||
    node.has_errors
  )
    return canvasInteractions.forwardEventToCanvas(e)

  if (!widget) {
    if (!isSelectOutputsMode.value) return
    if (!node.constructor.nodeData?.output_node)
      return canvasInteractions.forwardEventToCanvas(e)
    const index = appModeStore.selectedOutputs.findIndex(
      (id) => String(id) === String(node.id)
    )
    if (index === -1) appModeStore.selectedOutputs.push(node.id)
    else appModeStore.selectedOutputs.splice(index, 1)
    return
  }
  if (!isSelectInputsMode.value || widget.options.canvasOnly) return

  const storeId = isPromotedWidgetView(widget) ? widget.sourceNodeId : node.id
  const storeName = isPromotedWidgetView(widget)
    ? widget.sourceWidgetName
    : widget.name
  const index = appModeStore.selectedInputs.findIndex(
    ([nodeId, widgetName]) =>
      String(storeId) === String(nodeId) && storeName === widgetName
  )
  if (index === -1) appModeStore.selectedInputs.push([storeId, storeName])
  else appModeStore.selectedInputs.splice(index, 1)
}

function nodeToDisplayTuple(
  n: LGraphNode
): [NodeId, MaybeRef<BoundStyle> | undefined, boolean] {
  return [
    n.id,
    getBounding(n.id),
    appModeStore.selectedOutputs.some((id) => n.id === id)
  ]
}

const renderedOutputs = computed(() => {
  void appModeStore.selectedOutputs.length
  return canvas
    .graph!.nodes.filter(
      (n) =>
        n.constructor.nodeData?.output_node &&
        n.mode === LGraphEventMode.ALWAYS &&
        !n.has_errors
    )
    .map(nodeToDisplayTuple)
})

// All selectable input-widget candidates on the graph. Renders both
// unselected (faint ring) and selected (filled + thick ring) so the user
// can see what's clickable the moment they enter builder:inputs — the
// previous implementation only drew already-selected rows, which left
// discoverability to luck.
const renderedInputCandidates = computed(() => {
  if (!isSelectInputsMode.value) return []
  void appModeStore.selectedInputs.length
  if (settingStore.get('Comfy.VueNodes.Enabled')) return []
  const g = canvas.graph
  if (!g) return []

  const out: { key: string; style: BoundStyle; isSelected: boolean }[] = []
  for (const node of g.nodes) {
    if (node.mode !== LGraphEventMode.ALWAYS) continue
    if (!nodeTypeValidForApp(node.type)) continue
    if (node.has_errors) continue
    if (node.flags?.collapsed) continue
    if (!node.widgets) continue

    for (const widget of node.widgets) {
      if (widget.options?.canvasOnly) continue
      const style = getBounding(node.id, widget.name)
      if (!style) continue

      const storeId = isPromotedWidgetView(widget)
        ? widget.sourceNodeId
        : node.id
      const storeName = isPromotedWidgetView(widget)
        ? widget.sourceWidgetName
        : widget.name
      const isSelected = appModeStore.selectedInputs.some(
        ([nid, wn]) => String(storeId) === String(nid) && storeName === wn
      )

      out.push({ key: `${node.id}:${widget.name}`, style, isSelected })
    }
  }
  return out
})
</script>

<template>
  <Teleport
    v-if="isSelectMode && !settingStore.get('Comfy.VueNodes.Enabled')"
    to="body"
  >
    <div
      :class="
        cn(
          'pointer-events-auto absolute size-full bg-black/40',
          hoveringSelectable ? 'cursor-pointer' : 'cursor-grab'
        )
      "
      @pointerdown="handleDown"
      @pointermove="hoveringSelectable = !!getHovered($event)"
      @click="handleClick"
      @wheel="canvasInteractions.forwardEventToCanvas"
    >
      <TransformPane :canvas="canvasStore.getCanvas()">
        <template v-if="isSelectInputsMode">
          <div
            v-for="candidate in renderedInputCandidates"
            :key="candidate.key"
            :style="candidate.style"
            :class="
              cn(
                'fixed rounded-lg ring-2 ring-primary-background/60',
                candidate.isSelected &&
                  'bg-warning-background/15 ring-3 ring-warning-background'
              )
            "
          />
        </template>
        <template v-else>
          <div
            v-for="[key, style, isSelected] in renderedOutputs"
            :key
            :style="toValue(style)"
            :class="
              cn(
                'fixed rounded-2xl ring-5 ring-warning-background',
                !isSelected && 'ring-warning-background/50'
              )
            "
          >
            <div class="absolute top-0 right-0 size-8">
              <div
                v-if="isSelected"
                :class="[
                  'pointer-events-auto absolute -top-1/2 -right-1/2',
                  'size-full cursor-pointer rounded-lg p-2',
                  'bg-warning-background'
                ]"
                @click.stop="
                  remove(
                    appModeStore.selectedOutputs,
                    (k) => String(k) === String(key)
                  )
                "
                @pointerdown.stop
              >
                <i class="bg-text-foreground icon-[lucide--check] size-full" />
              </div>
              <div
                v-else
                :class="[
                  'pointer-events-auto absolute -top-1/2 -right-1/2',
                  'size-full cursor-pointer rounded-lg',
                  'bg-component-node-background',
                  'ring-4 ring-warning-background/50 ring-inset'
                ]"
                @click.stop="appModeStore.selectedOutputs.push(key)"
                @pointerdown.stop
              />
            </div>
          </div>
        </template>
      </TransformPane>
    </div>
  </Teleport>
</template>
