<script setup lang="ts">
import { refAutoReset, useElementBounding, useTimeoutFn } from '@vueuse/core'
import { clamp } from 'es-toolkit/math'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { app } from '@/scripts/app'
import { useAgentGeneratedNodesStore } from '@/stores/agentGeneratedNodesStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { frameBounds } from '@/utils/frameBoundsUtil'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

const MINIMAP_SETTING = 'Comfy.Minimap.Visible'

const CARD_CLASS =
  'pointer-events-auto flex items-center rounded-lg border border-l-4 border-interface-stroke bg-interface-panel-surface py-2 pr-2 pl-4 shadow-interface'

const { panelEl } = defineProps<{
  /** The graph viewport element, so framing centres on what is actually visible. */
  panelEl: HTMLElement | undefined
}>()

const { t } = useI18n()
const canvasInteractions = useCanvasInteractions()
const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()
const tabActivity = useWorkflowTabActivityStore()
const agentGeneratedNodes = useAgentGeneratedNodesStore()

/**
 * The marks standing when this turn began. Marks are provenance and outlive the
 * turn that made them, so a turn reads back its own work as the tail past this
 * count rather than by timestamp: several nodes can share a millisecond with
 * the previous turn's last mark.
 */
const marksBeforeTurn = ref(agentGeneratedNodes.markCount)

/** The finished turn's nodes, held until the next turn or a dismissal. */
const report = ref<NodeLocatorId[] | null>(null)

/**
 * How long idle has to hold before the turn counts as over. The panel reports
 * one message at a time, so a turn that writes, thinks and writes again dips to
 * idle between its own messages; taking each dip for the end would re-baseline
 * the count and drop the bar while the agent is still working.
 */
const TURN_SETTLE_MS = 1000

const turnRunning = ref(tabActivity.agentRunning)
const settle = useTimeoutFn(
  () => {
    turnRunning.value = false
  },
  TURN_SETTLE_MS,
  { immediate: false }
)
watch(
  () => tabActivity.agentRunning,
  (running) => {
    settle.stop()
    if (running) turnRunning.value = true
    else settle.start()
  }
)

const isUpdatingGraph = computed(
  () =>
    turnRunning.value && agentGeneratedNodes.markCount > marksBeforeTurn.value
)

/**
 * How long the updating bar stays up once it has appeared. A workflow the agent
 * builds from scratch lands in a single catch-up frame, so without a floor the
 * bar would enter and leave within a tick; holding it gives the ring, the
 * minimap's node pops and the copy time to register before the report replaces
 * it.
 */
const MIN_UPDATING_MS = 1200

const holdingUpdating = refAutoReset(false, MIN_UPDATING_MS)

const activeTabPath = computed(() => workflowStore.activeWorkflow?.path ?? null)

/** The tab the turn is writing to, taken as its first node lands. */
const turnTabPath = ref<string | null>(null)

watch(isUpdatingGraph, (updating) => {
  if (!updating) return
  turnTabPath.value = activeTabPath.value
  holdingUpdating.value = true
  // The map shows the nodes arriving, so it opens while they do if the user had
  // it closed, and stays open afterwards for reading the graph the agent built.
  if (!settingStore.get(MINIMAP_SETTING))
    void settingStore.set(MINIMAP_SETTING, true)
})

const showUpdating = computed(
  () => isUpdatingGraph.value || holdingUpdating.value
)

/**
 * Both bars describe one graph, so they stay on its tab: switching away leaves
 * them behind rather than reporting one workflow's nodes over another, and
 * switching back finds them where they were.
 */
const isShowing = computed(
  () =>
    (showUpdating.value || report.value !== null) &&
    turnTabPath.value === activeTabPath.value
)

watch(turnRunning, (running) => {
  if (running) {
    marksBeforeTurn.value = agentGeneratedNodes.markCount
    report.value = null
    return
  }
  // Report only a turn that actually reached the graph.
  const added = agentGeneratedNodes.markedNodesAfter(marksBeforeTurn.value)
  report.value = added.length > 0 ? added : null
})

/**
 * The side toolbar floats over the graph panel in some layouts and takes flex
 * space in others, so the visible graph is the panel less whatever the toolbar
 * covers on its leading edge. Measuring only while something is on screen keeps
 * the observers detached for the rest of the session.
 */
const sidebarEl = ref<HTMLElement | null>(null)
onMounted(() => {
  sidebarEl.value = document.querySelector<HTMLElement>(
    '.side-tool-bar-container'
  )
})
const measured = <T>(el: T) => (isShowing.value ? el : null)
// Neither box moves on a window scroll, and the listener for it is capture
// phase on window: every scrollable subtree in the app would measure both.
const BOUNDS_OPTIONS = { windowScroll: false }
const panelBounds = useElementBounding(
  () => measured(panelEl ?? null),
  BOUNDS_OPTIONS
)
const sidebarBounds = useElementBounding(
  () => measured(sidebarEl.value),
  BOUNDS_OPTIONS
)

/**
 * How far chrome that floats over the panel eats into each of its sides. An
 * overlay is attributed to the edge it starts from, and one laid out beside the
 * panel rather than over it reaches neither.
 */
function overlayInsets(panel: DOMRect, overlays: readonly DOMRect[]) {
  let left = 0
  let right = 0
  for (const overlay of overlays) {
    if (overlay.left <= panel.left)
      left = Math.max(left, overlay.right - panel.left)
    else right = Math.max(right, panel.right - overlay.left)
  }
  return {
    left: clamp(left, 0, panel.width),
    right: clamp(right, 0, panel.width)
  }
}

/** The ring starts where the toolbar stops covering the panel's leading edge. */
const sidebarOverlap = computed(() => {
  const panelLeft = panelBounds.left.value
  if (sidebarBounds.left.value > panelLeft) return 0
  return clamp(
    sidebarBounds.right.value - panelLeft,
    0,
    panelBounds.width.value
  )
})

/** Chrome drawn over the graph rather than laid out beside it. */
const OVERLAY_SELECTORS = ['.side-tool-bar-container', '.docked-agent-panel']

/**
 * The canvas element spans the whole window and runs under the sidebar, topbar
 * and panels, so centring on it puts nodes off-centre. The visible graph is the
 * panel's own box less whatever is drawn over its edges.
 */
function framingViewport(
  canvas: LGraphCanvas,
  panel: DOMRect
): [number, number, number, number] {
  const element = canvas.canvas.getBoundingClientRect()
  const overlays = OVERLAY_SELECTORS.flatMap((selector) => {
    const rect = document.querySelector(selector)?.getBoundingClientRect()
    return rect && rect.width > 0 ? [rect] : []
  })
  const inset = overlayInsets(panel, overlays)
  return [
    panel.left + inset.left - element.left,
    panel.top - element.top,
    Math.max(panel.width - inset.left - inset.right, 0),
    panel.height
  ]
}

function viewAddedNodes(): void {
  const canvas = canvasStore.canvas
  if (!canvas || !report.value || !panelEl) return
  const nodes = report.value.flatMap((locatorId) => {
    const node = getNodeByLocatorId(app.rootGraph, locatorId)
    return node && node.graph === canvas.graph ? [node] : []
  })
  const bounds = frameBounds(nodes)
  if (bounds)
    canvas.animateToBounds(bounds, {
      viewport: framingViewport(canvas, panelEl.getBoundingClientRect())
    })
}
</script>

<template>
  <!-- The workspace column holds the top toolbar, the canvas and the bottom
       panel, so the ring traces its edge to surround them. -->
  <!-- `defer`: the target is created in the same render pass as this bar. -->
  <Teleport defer to=".workspace-panel">
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      leave-active-class="transition-opacity duration-300 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isShowing && showUpdating"
        data-testid="agent-graph-edge-shimmer"
        class="agent-graph-edge-shimmer pointer-events-none absolute inset-y-0 right-0"
        :style="{ left: `${sidebarOverlap}px` }"
      />
    </Transition>
  </Teleport>

  <div
    v-if="isShowing"
    class="pointer-events-none absolute inset-x-0 bottom-8 z-1100 flex justify-center"
    :style="{ paddingLeft: `${sidebarOverlap}px` }"
    @wheel="canvasInteractions.forwardEventToCanvas"
  >
    <Transition
      mode="out-in"
      enter-active-class="transition-[transform,opacity] delay-100 duration-200 ease-out"
      leave-active-class="transition-[transform,opacity] duration-200 ease-in"
      enter-from-class="translate-y-4 opacity-0"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="showUpdating"
        key="updating"
        data-testid="agent-graph-activity-bar"
        :class="cn(CARD_CLASS, 'border-l-base-foreground pr-4')"
      >
        <i
          class="icon-[lucide--loader-circle] size-4 shrink-0 text-muted-foreground motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span class="agent-shimmer-text ml-2 text-sm whitespace-nowrap">
          {{ t('agent.updatingGraph') }}
        </span>
      </div>
      <div
        v-else-if="report"
        key="added"
        data-testid="agent-graph-added-toast"
        role="status"
        :class="cn(CARD_CLASS, 'border-l-success-background')"
      >
        <i
          class="icon-[lucide--check] size-4 shrink-0 text-success-background"
          aria-hidden="true"
        />
        <span class="ml-2 text-sm whitespace-nowrap text-base-foreground">
          {{ t('agent.nodesAdded', report.length) }}
        </span>
        <Button
          variant="secondary"
          size="sm"
          class="ml-12 whitespace-nowrap"
          @click="viewAddedNodes"
        >
          {{ t('agent.viewAddedNodes', report.length) }}
        </Button>
        <Button
          variant="muted-textonly"
          size="icon"
          class="ml-1 shrink-0"
          :aria-label="t('agent.close')"
          @click="report = null"
        >
          <i class="icon-[lucide--x] size-4" aria-hidden="true" />
        </Button>
      </div>
    </Transition>
  </div>
</template>
