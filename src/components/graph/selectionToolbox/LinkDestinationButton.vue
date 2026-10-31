<template>
  <span ref="goToControl" class="contents">
    <ToolboxButton
      v-if="singleDestination"
      :label="goToLabel(singleDestination)"
      icon="icon-[lucide--locate]"
      data-testid="go-to-link-destination-button"
      @click="goTo(singleDestination.node.id)"
    />
    <Menu v-else-if="destinations.length" :items="destinationItems">
      <template #trigger="{ open }">
        <Button
          :tooltip="$t('selectionToolbox.linkDestinations.goToLinkedNode')"
          variant="muted-textonly"
          :aria-label="$t('selectionToolbox.linkDestinations.goToLinkedNode')"
          data-testid="go-to-link-destination-menu-button"
          :class="cn('gap-0.5', open && 'bg-accent')"
        >
          <i class="icon-[lucide--locate]" />
          <i class="icon-[lucide--chevron-down] size-2.5" />
        </Button>
      </template>
      <template #item="{ item }">
        <span class="min-w-0 flex-1 truncate">
          {{ destinationNames.get(item.key ?? '') }}
        </span>
        <span v-if="item.badge" class="ml-4 text-xs text-muted-foreground">
          {{ item.badge }}
        </span>
      </template>
    </Menu>
  </span>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, nextTick, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import ToolboxButton from '@/components/graph/selectionToolbox/ToolboxButton.vue'
import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import type { LinkEnd } from '@/lib/litegraph/src/canvas/linkGeometry'
import { getSelectedLinkDestinations } from '@/lib/litegraph/src/canvas/linkSelection'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLinkDestinationNavigation } from '@/renderer/core/canvas/useLinkDestinationNavigation'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

const { t } = useI18n()
const linkSelectionStore = useLinkSelectionStore()
const canvasStore = useCanvasStore()
const { goToLinkDestination } = useLinkDestinationNavigation()
const goToControl = useTemplateRef<HTMLSpanElement>('goToControl')

const destinations = computed(() => {
  if (!linkSelectionStore.selection) return []
  const graph = canvasStore.canvas?.graph
  return graph ? getSelectedLinkDestinations(graph) : []
})

const singleDestination = computed(() =>
  destinations.value.length === 1 ? destinations.value[0] : undefined
)

const destinationNames = computed(
  () =>
    new Map<string, string>(
      destinations.value.map((destination) => [
        destination.node.id,
        destinationName(destination)
      ])
    )
)

const destinationItems = computed<MenuItem[]>(() =>
  destinations.value.map((destination) => {
    const name = destinationName(destination)
    const badge =
      destination.kind === 'node' ? `#${destination.node.id}` : undefined
    return {
      key: destination.node.id,
      label: badge ? `${name} ${badge}` : name,
      badge,
      command: () => goTo(destination.node.id)
    }
  })
)

function destinationName(destination: LinkEnd): string {
  switch (destination.kind) {
    case 'subgraphInputs':
      return t('selectionToolbox.linkDestinations.subgraphInputs')
    case 'subgraphOutputs':
      return t('selectionToolbox.linkDestinations.subgraphOutputs')
    case 'node':
      return (
        destination.node.getTitle() ||
        destination.node.type ||
        `#${destination.node.id}`
      )
  }
}

function goToLabel(destination: LinkEnd): string {
  return t('selectionToolbox.linkDestinations.goTo', {
    node: destinationName(destination)
  })
}

async function goTo(nodeId: NodeId) {
  if (!goToLinkDestination(nodeId)) return
  await nextTick()
  goToControl.value?.querySelector('button')?.focus()
}
</script>
