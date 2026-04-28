<script setup lang="ts">
/**
 * AppBuilder — graph-canvas selection overlay for the builder's
 * inputs/outputs steps. Renders the same SelectionChrome we use for
 * Vue-nodes mode, computing each ring's viewport rect from canvas
 * pan/zoom state on RAF. Sizes stay constant in screen pixels.
 *
 * Gated on `isSelectMode` and skipped when Vue nodes are enabled —
 * Vue nodes render their own AppInput/AppOutput rings via LGraphNode.
 */
import { useRafFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

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
import SelectionChrome from '@/renderer/extensions/linearMode/SelectionChrome.vue'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import { nodeTypeValidForApp, useAppModeStore } from '@/stores/appModeStore'

type Bounds = { top: number; left: number; width: number; height: number }
type Candidate = Bounds & {
  key: string
  isSelected: boolean
  onToggle: () => void
}

const appModeStore = useAppModeStore()
const canvasInteractions = useCanvasInteractions()
const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()
const canvas: LGraphCanvas = canvasStore.getCanvas()

const { isSelectMode, isSelectInputsMode, isSelectOutputsMode } = useAppMode()

workflowStore.activeWorkflow?.changeTracker?.reset()

const active = computed(
  () => isSelectMode.value && !settingStore.get('Comfy.VueNodes.Enabled')
)

// Canvas pan/zoom is applied via 2D-context transforms — no DOM events
// fire when the user pans/zooms, so we sample DragAndScale + the canvas
// element rect each frame to derive viewport-space bounds.
const viewport = ref({ rectLeft: 0, rectTop: 0, scale: 1, ox: 0, oy: 0 })
const { pause, resume } = useRafFn(
  () => {
    const r = canvas.canvas.getBoundingClientRect()
    viewport.value = {
      rectLeft: r.left,
      rectTop: r.top,
      scale: canvas.ds?.scale ?? 1,
      ox: canvas.ds?.offset?.[0] ?? 0,
      oy: canvas.ds?.offset?.[1] ?? 0
    }
  },
  { immediate: false }
)
watch(active, (a) => (a ? resume() : pause()), { immediate: true })

function toViewport(cx: number, cy: number, cw: number, ch: number): Bounds {
  const { rectLeft, rectTop, scale, ox, oy } = viewport.value
  return {
    left: (cx + ox) * scale + rectLeft,
    top: (cy + oy) * scale + rectTop,
    width: cw * scale,
    height: ch * scale
  }
}

function nodeBounds(node: LGraphNode): Bounds {
  const titleOffset =
    node.title_mode === TitleMode.NORMAL_TITLE ? LiteGraph.NODE_TITLE_HEIGHT : 0
  return toViewport(
    node.pos[0],
    node.pos[1] - titleOffset,
    node.size[0],
    node.size[1] + titleOffset
  )
}

function widgetBounds(node: LGraphNode, widget: IBaseWidget): Bounds {
  const margin = widget instanceof DOMWidgetImpl ? widget.margin : undefined
  const marginX = margin ?? BaseWidget.margin
  const heightCanvas =
    (widget.computedHeight !== undefined
      ? widget.computedHeight - 4
      : LiteGraph.NODE_WIDGET_HEIGHT) - (margin ? 2 * margin - 4 : 0)
  return toViewport(
    node.pos[0] + marginX,
    node.pos[1] + widget.y + (margin ?? 0),
    node.size[0] - marginX * 2,
    heightCanvas
  )
}

const candidates = computed<Candidate[]>(() => {
  if (!active.value) return []
  const g = canvas.graph
  if (!g) return []
  // Read viewport so the computed re-runs each frame as canvas state
  // updates (the iteration over g.nodes itself isn't reactive).
  void viewport.value

  if (isSelectInputsMode.value) {
    const out: Candidate[] = []
    for (const node of g.nodes) {
      if (node.mode !== LGraphEventMode.ALWAYS) continue
      if (!nodeTypeValidForApp(node.type)) continue
      if (node.has_errors) continue
      if (node.flags?.collapsed) continue
      if (!node.widgets) continue
      for (const widget of node.widgets) {
        if (widget.options?.canvasOnly) continue
        const storeId = isPromotedWidgetView(widget)
          ? widget.sourceNodeId
          : node.id
        const storeName = isPromotedWidgetView(widget)
          ? widget.sourceWidgetName
          : widget.name
        out.push({
          key: `${node.id}:${widget.name}`,
          ...widgetBounds(node, widget),
          isSelected: appModeStore.selectedInputs.some(
            ([nid, wn]) => String(storeId) === String(nid) && storeName === wn
          ),
          onToggle: () => appModeStore.toggleSelectedInput(storeId, storeName)
        })
      }
    }
    return out
  }

  if (isSelectOutputsMode.value) {
    return g.nodes
      .filter(
        (n) =>
          n.constructor.nodeData?.output_node &&
          n.mode === LGraphEventMode.ALWAYS &&
          !n.has_errors
      )
      .map((node) => {
        const sid = String(node.id)
        return {
          key: sid,
          ...nodeBounds(node),
          isSelected: appModeStore.selectedOutputs.some(
            (id) => String(id) === sid
          ),
          onToggle: () => appModeStore.toggleSelectedOutput(node.id as NodeId)
        }
      })
  }
  return []
})
</script>

<template>
  <template v-if="active">
    <Teleport to="body">
      <div
        class="pointer-events-auto fixed inset-0 cursor-grab bg-black/40"
        @pointerdown="canvasInteractions.forwardEventToCanvas"
        @click="canvasInteractions.forwardEventToCanvas"
        @wheel="canvasInteractions.forwardEventToCanvas"
      />
    </Teleport>
    <SelectionChrome
      v-for="c in candidates"
      :key="c.key"
      :is-selected="c.isSelected"
      :top="c.top"
      :left="c.left"
      :width="c.width"
      :height="c.height"
      @toggle="c.onToggle"
    />
  </template>
</template>
