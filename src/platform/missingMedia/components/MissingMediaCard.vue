<template>
  <div class="px-3">
    <TransitionGroup
      tag="ul"
      name="list-scale"
      class="relative m-0 list-none space-y-1 p-0"
    >
      <li
        v-for="item in missingMediaItems"
        :key="item.key"
        data-testid="missing-media-row"
        :aria-current="
          highlightedNodeIds?.has(item.nodeId) ? 'true' : undefined
        "
        class="min-w-0"
      >
        <!-- Emphasis lives on an inner element: the li is a TransitionGroup
             child, and the emphasis transition-property would override the
             list-scale move/enter/leave transitions. -->
        <div
          :class="
            cn(
              'flex min-w-0 items-center gap-2',
              selectionEmphasisClass(highlightedNodeIds?.has(item.nodeId))
            )
          "
        >
          <span class="flex min-w-0 flex-1">
            <button
              type="button"
              class="focus-visible:ring-ring m-0 inline max-w-full cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left text-xs/relaxed font-normal wrap-break-word text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
              @click="emit('locateNode', item.nodeId)"
            >
              {{ item.displayItemLabel }}
            </button>
          </span>
          <Button
            data-testid="missing-media-locate-button"
            variant="textonly"
            size="icon-sm"
            class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
            :aria-label="
              t(
                'rightSidePanel.locateNodeFor',
                {
                  item: item.displayItemLabel
                },
                { escapeParameter: false }
              )
            "
            @click.stop="emit('locateNode', item.nodeId)"
          >
            <i aria-hidden="true" class="icon-[lucide--locate] size-4" />
          </Button>
        </div>
      </li>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { selectionEmphasisClass } from '@/components/rightSidePanel/errors/selectionEmphasis'
import { resolveMissingMediaItemLabel } from '@/platform/errorCatalog/errorMessageResolver'
import { getMissingMediaReferences } from '@/platform/missingMedia/missingMediaGrouping'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import { app } from '@/scripts/app'
import { st } from '@/i18n'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'

const { missingMediaGroups } = defineProps<{
  missingMediaGroups: MissingMediaGroup[]
  /** Execution node ids to emphasize (current canvas selection). */
  highlightedNodeIds?: Set<string>
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
}>()

const { t } = useI18n()

interface MissingMediaItemEntry {
  key: string
  nodeId: string
  displayItemLabel: string
}

const missingMediaItems = computed(() => {
  return getMissingMediaReferences(missingMediaGroups)
    .map(({ mediaItem, nodeRef }) => {
      const nodeId = String(nodeRef.nodeId)
      return {
        key: `${nodeId}:${nodeRef.widgetName}:${mediaItem.name}`,
        nodeId,
        displayItemLabel: getDisplayItemLabel(
          nodeId,
          nodeRef.nodeType ?? mediaItem.representative.nodeType,
          nodeRef.widgetName
        )
      }
    })
    .sort(compareMissingMediaItems)
})

function getDisplayItemLabel(
  nodeId: string,
  nodeType: string,
  widgetName: string
) {
  const nodeDisplayName = getNodeDisplayLabel(nodeId, '')
  return resolveMissingMediaItemLabel({
    nodeDisplayName,
    nodeType,
    widgetName
  }).displayItemLabel
}

function compareMissingMediaItems(
  a: MissingMediaItemEntry,
  b: MissingMediaItemEntry
) {
  return (
    a.nodeId.localeCompare(b.nodeId, undefined, { numeric: true }) ||
    a.displayItemLabel.localeCompare(b.displayItemLabel)
  )
}

function getNodeDisplayLabel(nodeId: string, fallback: string): string {
  const graph = app.rootGraph
  if (!graph) return fallback
  const node = getNodeByExecutionId(graph, nodeId)
  return resolveNodeDisplayName(node, {
    emptyLabel: fallback,
    untitledLabel: fallback,
    st
  })
}
</script>
