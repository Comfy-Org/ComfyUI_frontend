<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import CanvasBanner from '@/components/graph/CanvasBanner.vue'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { toRootGraphId } from '@/types/graphScopeId'
import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { frameBounds } from '@/utils/frameBoundsUtil'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'

import type { GraphActivity } from '../../stores/agentGeneratedNodesStore'

defineOptions({ inheritAttrs: false })

const { activities } = defineProps<{
  activities: ReadonlyMap<RootGraphId, GraphActivity>
}>()
const emit = defineEmits<{ dismiss: [rootId: RootGraphId] }>()

const { t } = useI18n()
const workflowStore = useWorkflowStore()
const navigationStore = useSubgraphNavigationStore()

const rootId = computed(() => {
  const id = workflowStore.activeWorkflow?.activeState?.id
  return id ? toRootGraphId(id) : null
})
const activity = computed(() =>
  rootId.value ? activities.get(rootId.value) : undefined
)

async function viewNodes(locators: readonly NodeLocatorId[]): Promise<void> {
  const canvas = app.canvas
  const activeRootId = rootId.value
  if (!canvas || app.rootGraph.id !== activeRootId) return

  const resolved = locators.flatMap((locator) => {
    const node = getNodeByLocatorId(app.rootGraph, locator)
    return node ? [node] : []
  })
  const owner = resolved.at(-1)?.graph
  if (!owner) return

  if (!(await navigationStore.navigateToGraph(owner))) return

  if (rootId.value !== activeRootId || app.rootGraph.id !== activeRootId) return
  const bounds = frameBounds(resolved.filter((node) => node.graph === owner))
  if (bounds)
    canvas.animateToBounds(bounds, { viewport: visibleCanvasViewport(canvas) })
}

function dismiss(): void {
  if (rootId.value) emit('dismiss', rootId.value)
}
</script>

<template>
  <div
    v-if="activity"
    class="pointer-events-none absolute inset-x-0 bottom-8 z-1100 flex justify-center"
  >
    <CanvasBanner
      v-if="activity.phase === 'working'"
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
      <template #title>{{ t('agent.updatingGraph') }}</template>
      <template #description>{{ t('agent.editWhileWorking') }}</template>
      <template #actions>
        <Button
          variant="secondary"
          size="sm"
          data-testid="agent-graph-view-working"
          @click="viewNodes(activity.nodes)"
        >
          {{ t('agent.viewAddedNodes', activity.nodes.length) }}
        </Button>
      </template>
    </CanvasBanner>
    <CanvasBanner
      v-else
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
      <template #title>{{
        t('agent.nodesAdded', activity.nodes.length)
      }}</template>
      <template #actions>
        <div class="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            @click="viewNodes(activity.nodes)"
          >
            {{ t('agent.viewAddedNodes', activity.nodes.length) }}
          </Button>
          <Button
            variant="muted-textonly"
            size="icon"
            class="shrink-0"
            :aria-label="t('agent.close')"
            @click="dismiss"
          >
            <i class="icon-[lucide--x] size-4" aria-hidden="true" />
          </Button>
        </div>
      </template>
    </CanvasBanner>
  </div>
</template>
