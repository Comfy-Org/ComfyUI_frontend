<template>
  <!-- Create a new stacking context for widgets to avoid z-index issues -->
  <div class="isolate">
    <DomWidget
      v-for="widgetState in widgetStates"
      :key="widgetState.widget.id"
      :widget-state="widgetState"
      @update:widget-value="widgetState.widget.value = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { computed } from 'vue'

import DomWidget from '@/components/graph/widgets/DomWidget.vue'
import { getDomWidgetZIndex } from '@/components/graph/widgets/domWidgetZIndex'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

const domWidgetStore = useDomWidgetStore()
const overrideTransitionGrace = new Set<string>()

const widgetStates = computed(() => [...domWidgetStore.widgetStates.values()])

// Track canvas viewport between frames. Screen-space position depends on
// lgCanvas.ds.offset and ds.scale, which are non-reactive. When the user
// pans or zooms, canvas-space `pos` is unchanged but the rendered style
// must update — force pos reassignment whenever the viewport changes so
// the downstream watcher in DomWidget recomputes style with current ds.
let lastViewportOffsetX = Number.NaN
let lastViewportOffsetY = Number.NaN
let lastViewportScale = Number.NaN

// Track the selected node's identity and bounds between frames. DOM widget
// clipping is computed against the selected node's renderArea (non-reactive).
// When the user drags or resizes the selected node, widgets owned by other
// nodes must re-evaluate their clip-path even though their own pos hasn't
// changed — force pos reassignment on those widgets so the downstream
// watcher in DomWidget re-runs updateDomClipping().
let lastSelectedNodeId: string | number | undefined
let lastSelectedPosX = 0
let lastSelectedPosY = 0
let lastSelectedWidth = 0
let lastSelectedHeight = 0

const updateWidgets = () => {
  const lgCanvas = canvasStore.canvas
  if (!lgCanvas) return

  const lowQuality = lgCanvas.low_quality
  const currentGraph = lgCanvas.graph
  const seenWidgetIds = new Set<string>()

  const viewportOffsetX = lgCanvas.ds.offset[0]
  const viewportOffsetY = lgCanvas.ds.offset[1]
  const viewportScale = lgCanvas.ds.scale
  const viewportChanged =
    lastViewportOffsetX !== viewportOffsetX ||
    lastViewportOffsetY !== viewportOffsetY ||
    lastViewportScale !== viewportScale
  lastViewportOffsetX = viewportOffsetX
  lastViewportOffsetY = viewportOffsetY
  lastViewportScale = viewportScale

  const selectedNode = Object.values(lgCanvas.selected_nodes ?? {})[0]
  const selectedNodeId = selectedNode?.id
  const selectedPosX = selectedNode ? selectedNode.pos[0] : 0
  const selectedPosY = selectedNode ? selectedNode.pos[1] : 0
  const selectedWidth = selectedNode ? selectedNode.size[0] : 0
  const selectedHeight = selectedNode ? selectedNode.size[1] : 0
  const selectionChanged =
    lastSelectedNodeId !== selectedNodeId ||
    (!!selectedNode &&
      (lastSelectedPosX !== selectedPosX ||
        lastSelectedPosY !== selectedPosY ||
        lastSelectedWidth !== selectedWidth ||
        lastSelectedHeight !== selectedHeight))
  lastSelectedNodeId = selectedNodeId
  lastSelectedPosX = selectedPosX
  lastSelectedPosY = selectedPosY
  lastSelectedWidth = selectedWidth
  lastSelectedHeight = selectedHeight

  for (const widgetState of widgetStates.value) {
    const widget = widgetState.widget
    seenWidgetIds.add(widget.id)

    // Use position override only when the override node (SubgraphNode) is
    // in the current graph. When the user enters the subgraph, the override
    // node is no longer visible — fall back to the widget's own node.
    // Use graph reference equality (IDs are not unique across graphs).
    const override = widgetState.positionOverride
    const useOverride = !!override && currentGraph === override.node.graph
    const inOverrideTransitionGap =
      !!override && !useOverride && !widgetState.active
    const useTransitionGrace =
      inOverrideTransitionGap && !overrideTransitionGrace.has(widget.id)

    if (useTransitionGrace) {
      overrideTransitionGrace.add(widget.id)
    } else if (!inOverrideTransitionGap) {
      overrideTransitionGrace.delete(widget.id)
    }

    // Early exit for non-visible widgets.
    // When a position override is active (widget promoted to SubgraphNode),
    // the interior widget's `active` flag is false (its node is in the
    // subgraph, not the current graph) — bypass that check.
    if (
      !widget.isVisible() ||
      (!widgetState.active && !useOverride && !useTransitionGrace)
    ) {
      widgetState.visible = false
      continue
    }

    // During graph transitions, hold the previous position for one frame
    // so promoted widgets don't briefly disappear before activation flips.
    if (useTransitionGrace) continue

    const posNode = useOverride ? override.node : widget.node
    const posWidget = useOverride ? override.widget : widget

    const isInCorrectGraph = posNode.graph === currentGraph
    const nodeVisible = lgCanvas.isNodeVisible(posNode)

    widgetState.visible =
      isInCorrectGraph &&
      nodeVisible &&
      !(widget.options.hideOnZoom && lowQuality)

    if (widgetState.visible) {
      const margin = widget.margin
      const newPosX = posNode.pos[0] + margin
      const newPosY = posNode.pos[1] + margin + posWidget.y
      if (
        viewportChanged ||
        selectionChanged ||
        widgetState.pos[0] !== newPosX ||
        widgetState.pos[1] !== newPosY
      ) {
        widgetState.pos = [newPosX, newPosY]
      }

      const newWidth = (posWidget.width ?? posNode.width) - margin * 2
      const newHeight = (posWidget.computedHeight ?? 50) - margin * 2
      if (
        widgetState.size[0] !== newWidth ||
        widgetState.size[1] !== newHeight
      ) {
        widgetState.size = [newWidth, newHeight]
      }

      const newZIndex = getDomWidgetZIndex(posNode, currentGraph)
      if (widgetState.zIndex !== newZIndex) {
        widgetState.zIndex = newZIndex
      }

      const newReadonly = lgCanvas.read_only
      if (widgetState.readonly !== newReadonly) {
        widgetState.readonly = newReadonly
      }

      const newComputedDisabled = useOverride
        ? (override.widget.computedDisabled ?? widget.computedDisabled ?? false)
        : (widget.computedDisabled ?? false)
      if (widgetState.computedDisabled !== newComputedDisabled) {
        widgetState.computedDisabled = newComputedDisabled
      }
    }
  }

  for (const widgetId of overrideTransitionGrace) {
    if (!seenWidgetIds.has(widgetId)) {
      overrideTransitionGrace.delete(widgetId)
    }
  }
}

const canvasStore = useCanvasStore()
whenever(
  () => canvasStore.canvas,
  (canvas) =>
    (canvas.onDrawForeground = useChainCallback(
      canvas.onDrawForeground,
      updateWidgets
    )),
  { immediate: true }
)
</script>
