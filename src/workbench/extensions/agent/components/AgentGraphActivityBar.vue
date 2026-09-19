<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CanvasBanner from '@/components/graph/CanvasBanner.vue'
import Button from '@/components/ui/button/Button.vue'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { createPositionBounds } from '@/utils/positionBounds'

import { useAgentGraphActivityStore } from '../stores/agent/agentGraphActivityStore'

const { t } = useI18n()
const { canvas } = defineProps<{ canvas: LGraphCanvas | null }>()
const activity = useAgentGraphActivityStore()
const teleportTarget = ref<HTMLElement | null>(null)
onMounted(() => {
  teleportTarget.value = document.querySelector('.graph-canvas-panel')
})

const visibleState = computed(() =>
  activity.state.phase === 'idle' ? null : activity.state
)
const isComplete = computed(() => visibleState.value?.phase === 'complete')
const liveNodes = computed(() => {
  const state = visibleState.value
  if (!state || !canvas || String(app.rootGraph.id) !== state.rootGraphId)
    return []
  return state.nodeIds.flatMap((nodeId) => {
    const locator = createNodeLocatorId(null, nodeId)
    const node = getNodeByLocatorId(app.rootGraph, locator)
    return locator && node?.graph === canvas.graph ? [node] : []
  })
})

function viewNodes(): void {
  const panel = document.querySelector<HTMLElement>('.graph-canvas-panel')
  if (!canvas || !panel) return
  const bounds = createPositionBounds(liveNodes.value, 40)
  if (!bounds) return
  const canvasRect = canvas.canvas.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  canvas.animateToBounds(bounds, {
    viewport: [
      panelRect.left - canvasRect.left,
      panelRect.top - canvasRect.top,
      panelRect.width,
      panelRect.height
    ]
  })
}
</script>

<template>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <div
      v-if="visibleState"
      class="pointer-events-none absolute inset-x-2 bottom-8 z-1100 flex justify-center"
    >
      <CanvasBanner
        :data-testid="
          isComplete ? 'agent-graph-added-toast' : 'agent-graph-activity-bar'
        "
        role="status"
        :accent="
          isComplete
            ? 'border-l-success-background'
            : 'border-l-base-foreground'
        "
        class="max-w-full flex-wrap gap-3"
      >
        <template #icon>
          <i
            :class="
              isComplete
                ? 'icon-[lucide--check] text-success-background'
                : 'icon-[lucide--loader-circle] text-muted-foreground motion-safe:animate-spin'
            "
            class="size-4 shrink-0"
            aria-hidden="true"
          />
        </template>
        <template #title>
          {{
            isComplete
              ? t('agent.nodesAdded', visibleState.nodeIds.length)
              : t('agent.updatingGraph')
          }}
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
              class="whitespace-nowrap"
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
              <i class="icon-[lucide--x] size-4" aria-hidden="true" />
            </Button>
          </div>
        </template>
      </CanvasBanner>
    </div>
  </Teleport>
</template>
