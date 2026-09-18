<script setup lang="ts">
import { refAutoReset, useElementBounding, useTimeoutFn } from '@vueuse/core'
import { clamp } from 'es-toolkit/math'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CanvasBanner from '@/components/graph/CanvasBanner.vue'
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
import { createPositionBounds } from '@/utils/positionBounds'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

const MINIMAP_SETTING = 'Comfy.Minimap.Visible'

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
 * turn that made them, so a turn reads back its own work as whatever is marked
 * now and was not marked then. Held as a set rather than a count because a
 * deleted node drops its mark.
 */
const marksBeforeTurn = ref(new Set(agentGeneratedNodes.markedNodes))

/** The finished turn's nodes, held until the next turn or a dismissal. */
const report = ref<NodeLocatorId[] | null>(null)

/** The tab the turn is writing to, taken as its first node lands. */
const turnTabPath = ref<string | null>(null)

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
    if (!running) {
      settle.start()
      return
    }
    // Only a turn that starts from idle takes a new baseline. Coming back
    // inside the settle is the same turn, and it keeps the one it began with.
    if (!turnRunning.value) {
      marksBeforeTurn.value = new Set(agentGeneratedNodes.markedNodes)
      turnTabPath.value = null
      report.value = null
    }
    turnRunning.value = true
  }
)

/** What this turn has put on the graph so far. */
const addedNodes = computed(() =>
  agentGeneratedNodes.markedNodes.filter(
    (locatorId) => !marksBeforeTurn.value.has(locatorId)
  )
)

/**
 * A turn only earns the bar by reaching the graph. Answering a question is not
 * activity the canvas has anything to say about.
 */
const isWritingGraph = computed(
  () => turnRunning.value && addedNodes.value.length > 0
)

/**
 * How long the bar stays up once it has appeared. A workflow the agent builds
 * from scratch lands in a single catch-up frame, so without a floor the bar
 * would enter and leave within a tick; holding it gives the minimap's node pops
 * and the copy time to register before the report replaces it.
 */
const MIN_WORKING_MS = 1200

const holdingWorking = refAutoReset(false, MIN_WORKING_MS)

const activeTabPath = computed(() => workflowStore.activeWorkflow?.path ?? null)

watch(isWritingGraph, (writing) => {
  if (!writing) return
  turnTabPath.value = activeTabPath.value
  holdingWorking.value = true
  // The map shows the nodes arriving, so it opens while they do if the user had
  // it closed, and stays open for reading the graph the agent built.
  if (!settingStore.get(MINIMAP_SETTING))
    void settingStore.set(MINIMAP_SETTING, true)
})

const showWorking = computed(() => isWritingGraph.value || holdingWorking.value)

/**
 * Both bars describe one graph, so they stay on its tab: switching away leaves
 * them behind rather than reporting one workflow's nodes over another, and
 * switching back finds them where they were.
 */
const isShowing = computed(
  () =>
    (showWorking.value || report.value !== null) &&
    turnTabPath.value === activeTabPath.value
)

watch(turnRunning, (running) => {
  if (running) return
  // Report only a turn that actually reached the graph.
  report.value = addedNodes.value.length > 0 ? addedNodes.value : null
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

/** Centring ignores the width the toolbar covers on the panel's leading edge. */
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

function viewNodes(locators: readonly NodeLocatorId[]): void {
  const canvas = canvasStore.canvas
  if (!canvas || !panelEl || locators.length === 0) return
  const nodes = locators.flatMap((locatorId) => {
    const node = getNodeByLocatorId(app.rootGraph, locatorId)
    return node && node.graph === canvas.graph ? [node] : []
  })
  const bounds = createPositionBounds(nodes, 40)
  if (bounds)
    canvas.animateToBounds(bounds, {
      viewport: framingViewport(canvas, panelEl.getBoundingClientRect())
    })
}
</script>

<template>
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
      <CanvasBanner
        v-if="showWorking"
        key="updating"
        data-testid="agent-graph-activity-bar"
        role="status"
        accent="border-l-base-foreground"
        class="agent-banner-shimmer"
      >
        <template #icon>
          <i
            class="icon-[lucide--loader-circle] size-4 shrink-0 text-muted-foreground motion-safe:animate-spin"
            aria-hidden="true"
          />
        </template>
        <template #title>
          <span class="whitespace-nowrap">{{ t('agent.updatingGraph') }}</span>
        </template>
        <template #description>
          <span class="whitespace-nowrap">{{
            t('agent.editWhileWorking')
          }}</span>
        </template>
        <template #actions>
          <Button
            variant="secondary"
            size="sm"
            class="whitespace-nowrap"
            data-testid="agent-graph-view-working"
            @click="viewNodes(addedNodes)"
          >
            {{ t('agent.viewAddedNodes', addedNodes.length) }}
          </Button>
        </template>
      </CanvasBanner>
      <CanvasBanner
        v-else-if="report"
        key="added"
        data-testid="agent-graph-added-toast"
        role="status"
        accent="border-l-success-background"
      >
        <template #icon>
          <i
            class="icon-[lucide--check] size-4 shrink-0 text-success-background"
            aria-hidden="true"
          />
        </template>
        <template #title>
          <span class="whitespace-nowrap">
            {{ t('agent.nodesAdded', report.length) }}
          </span>
        </template>
        <template #actions>
          <div class="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              class="whitespace-nowrap"
              @click="viewNodes(report)"
            >
              {{ t('agent.viewAddedNodes', report.length) }}
            </Button>
            <Button
              variant="muted-textonly"
              size="icon"
              class="shrink-0"
              :aria-label="t('agent.close')"
              @click="report = null"
            >
              <i class="icon-[lucide--x] size-4" aria-hidden="true" />
            </Button>
          </div>
        </template>
      </CanvasBanner>
    </Transition>
  </div>
</template>
