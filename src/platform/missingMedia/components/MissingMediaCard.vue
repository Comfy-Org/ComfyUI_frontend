<template>
  <div class="px-4 pb-2">
    <TransitionGroup
      tag="ul"
      name="list-scale"
      class="relative m-0 list-none space-y-1 p-0"
    >
      <li
        v-for="item in missingMediaItems"
        :key="item.key"
        data-testid="missing-media-row"
        class="min-w-0"
      >
        <div class="flex min-w-0 items-center gap-2">
          <span class="flex min-w-0 flex-1">
            <button
              type="button"
              class="focus-visible:ring-ring m-0 inline max-w-full cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left text-sm/relaxed font-normal wrap-break-word text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:underline focus-visible:ring-1 focus-visible:outline-none"
              @click="emit('locateNode', item.nodeId)"
            >
              {{ item.displayItemLabel }}
            </button>
          </span>
          <Button
            data-testid="missing-media-locate-button"
            variant="textonly"
            size="icon-sm"
            class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
            :aria-label="
              t('rightSidePanel.locateNodeFor', {
                item: item.displayItemLabel
              })
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

import Button from '@/components/ui/button/Button.vue'
import { resolveMissingMediaItemLabel } from '@/platform/errorCatalog/errorMessageResolver'
import { getMissingMediaReferences } from '@/platform/missingMedia/missingMediaGrouping'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import { app } from '@/scripts/app'
import { st } from '@/i18n'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'

const { missingMediaGroups } = defineProps<{
  missingMediaGroups: MissingMediaGroup[]
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
