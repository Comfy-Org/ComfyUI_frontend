<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CanvasBanner from '@comfyorg/design-system/common/CanvasBanner'
import Button from '@comfyorg/design-system/button/Button'
import type { ReadOnlyRect } from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useApp } from '@/scripts/appInstance'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { createPositionBounds } from '@/utils/positionBounds'

import { shouldFrameAgentBatch } from '@/workbench/extensions/agent/crdt/batchFraming'
import { useAgentGraphActivityStore } from '@/workbench/extensions/agent/stores/agent/agentGraphActivityStore'

const { t } = useI18n()
const { canvas } = defineProps<{ canvas: LGraphCanvas | null }>()
const activity = useAgentGraphActivityStore()
const teleportTarget = ref<HTMLElement | null>(null)
onMounted(() => {
  teleportTarget.value = document.querySelector('.graph-canvas-panel')
})

const visibleState = computed(() => {
  const state = activity.state
  if (
    state.phase === 'idle' ||
    !canvas?.graph ||
    String(canvas.graph.id) !== state.rootGraphId
  )
    return null
  return state
})
const isComplete = computed(() => visibleState.value?.phase === 'complete')
const presentation = computed(() => ({
  testId: isComplete.value
    ? 'agent-graph-added-toast'
    : 'agent-graph-activity-bar',
  accent: isComplete.value ? 'border-l-success' : 'border-l-foreground',
  iconClass: isComplete.value
    ? 'icon-[lucide--check] text-success'
    : 'icon-[lucide--loader-circle] text-muted-foreground motion-safe:animate-spin',
  title: isComplete.value
    ? t('agent.nodesAdded', visibleState.value?.nodeIds.length ?? 0)
    : t('agent.updatingGraph')
}))
const liveNodes = computed(() => {
  const state = visibleState.value
  if (!state || !canvas) return []
  return state.nodeIds.flatMap((nodeId) => {
    const locator = createNodeLocatorId(null, nodeId)
    const node = getNodeByLocatorId(useApp().rootGraph, locator)
    return locator && node?.graph === canvas.graph ? [node] : []
  })
})

const FRAME_PADDING = 40
const BATCH_SETTLE_MS = 150

function uncoveredViewport(): ReadOnlyRect | null {
  const panel = document.querySelector<HTMLElement>('.graph-canvas-panel')
  if (!canvas || !panel) return null
  const panelRect = panel.getBoundingClientRect()
  if (!(panelRect.width > 0) || !(panelRect.height > 0)) return null
  const canvasRect = canvas.canvas.getBoundingClientRect()
  return [
    panelRect.left - canvasRect.left,
    panelRect.top - canvasRect.top,
    panelRect.width,
    panelRect.height
  ]
}

function uncoveredViewportInGraphSpace(): ReadOnlyRect | null {
  const viewport = uncoveredViewport()
  if (!canvas || !viewport || !(canvas.ds.scale > 0)) return null
  const [left, top] = canvas.ds.convertCanvasToOffset([
    viewport[0],
    viewport[1]
  ])
  return [
    left,
    top,
    viewport[2] / canvas.ds.scale,
    viewport[3] / canvas.ds.scale
  ]
}

function viewNodes(): boolean {
  const viewport = uncoveredViewport()
  const bounds = createPositionBounds(liveNodes.value, FRAME_PADDING)
  if (!canvas || !viewport || !bounds) return false
  canvas.animateToBounds(bounds, { viewport })
  return true
}

let settleTimer: ReturnType<typeof setTimeout> | undefined

function frameBatchIfUnseen(): void {
  settleTimer = undefined
  const nodes = liveNodes.value
  if (!visibleState.value || !canvas?.graph || nodes.length === 0) return
  if (activity.currentTurnFramed) return
  const batchIds = new Set(nodes.map((node) => node.id))
  const frame = shouldFrameAgentBatch({
    batch: nodes,
    nodesNotInBatch: canvas.graph.nodes.filter((node) => !batchIds.has(node.id))
      .length,
    viewport: uncoveredViewportInGraphSpace()
  })
  if (!frame) return
  if (viewNodes()) activity.markCurrentTurnFramed()
}

watch(
  () => [visibleState.value, liveNodes.value] as const,
  () => {
    if (settleTimer !== undefined) clearTimeout(settleTimer)
    settleTimer = setTimeout(frameBatchIfUnseen, BATCH_SETTLE_MS)
  },
  { flush: 'post', immediate: true }
)
onUnmounted(() => {
  if (settleTimer !== undefined) clearTimeout(settleTimer)
})
</script>

<template>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <div
      v-if="visibleState"
      class="pointer-events-none absolute inset-x-2 bottom-8 flex justify-center"
    >
      <CanvasBanner
        :data-testid="presentation.testId"
        role="status"
        :accent="presentation.accent"
        class="max-w-full flex-wrap gap-3"
      >
        <template #icon>
          <i :class="presentation.iconClass" aria-hidden="true" />
        </template>
        <template #title>
          {{ presentation.title }}
        </template>
        <template v-if="!isComplete" #description>
          {{ t('agent.editWhileWorking') }}
        </template>
        <template #actions>
          <div class="flex min-w-0 items-center gap-1">
            <Button
              v-if="liveNodes.length > 0"
              variant="secondary"
              size="sm"
              @click="viewNodes"
            >
              {{ t('agent.viewAddedNodes', liveNodes.length) }}
            </Button>
            <Button
              v-if="isComplete"
              variant="muted-textonly"
              size="icon"
              class="shrink-0"
              :aria-label="t('agent.close')"
              @click="activity.dismiss()"
            >
              <i class="icon-[lucide--x]" aria-hidden="true" />
            </Button>
          </div>
        </template>
      </CanvasBanner>
    </div>
  </Teleport>
</template>
