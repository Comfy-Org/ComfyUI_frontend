<template>
  <span ref="goToControl" class="contents">
    <ToolboxButton
      v-if="singleDestinationButton"
      v-bind="singleDestinationButton"
      icon="icon-[lucide--locate]"
      data-testid="go-to-link-destination-button"
    />
    <Menu v-else-if="destinations.length" class="max-w-80">
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
      <MenuItem
        v-for="destination in destinations"
        :key="destination.node.id"
        @select="goTo(destination.node.id)"
      >
        <span class="min-w-0 flex-1 truncate">
          {{ destinationName(destination) }}
        </span>
        <span
          v-if="destination.kind === 'node'"
          class="ml-4 text-xs text-muted-foreground"
        >
          #{{ destination.node.id }}
        </span>
      </MenuItem>
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
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
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

const singleDestinationButton = computed(() => {
  if (destinations.value.length !== 1) return undefined
  const [destination] = destinations.value
  return {
    label: goToLabel(destination),
    onClick: () => goTo(destination.node.id)
  }
})

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
