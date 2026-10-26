<template>
  <span ref="goToControl" class="contents">
    <Button
      v-if="singleDestination"
      :tooltip="goToLabel(singleDestination)"
      variant="muted-textonly"
      :aria-label="goToLabel(singleDestination)"
      data-testid="go-to-link-destination-button"
      @click="goTo(singleDestination.node.id)"
    >
      <i class="icon-[lucide--locate]" />
    </Button>
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
  <Button
    v-if="linksHidden"
    :tooltip="$t('commands.Comfy_Canvas_ShowSelectedLinks.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Canvas_ShowSelectedLinks.label')"
    data-testid="show-links-button"
    @click="() => commandStore.execute('Comfy.Canvas.ShowSelectedLinks')"
  >
    <i class="icon-[lucide--eye]" />
  </Button>
  <Button
    v-else
    :tooltip="$t('commands.Comfy_Canvas_HideSelectedLinks.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Canvas_HideSelectedLinks.label')"
    data-testid="hide-links-button"
    @click="() => commandStore.execute('Comfy.Canvas.HideSelectedLinks')"
  >
    <i class="icon-[lucide--eye-off]" />
  </Button>
  <Button
    :tooltip="$t('commands.Comfy_Canvas_DeleteSelectedLinks.label')"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Canvas_DeleteSelectedLinks.label')"
    data-testid="delete-links-button"
    @click="() => commandStore.execute('Comfy.Canvas.DeleteSelectedLinks')"
  >
    <i class="icon-[lucide--trash-2]" />
  </Button>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, nextTick, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import type { LinkEnd } from '@/lib/litegraph/src/canvas/linkGeometry'
import {
  areSelectedLinksHidden,
  getSelectedLinkDestinations
} from '@/lib/litegraph/src/canvas/linkSelection'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLinkDestinationNavigation } from '@/renderer/core/canvas/useLinkDestinationNavigation'
import { useCommandStore } from '@/stores/commandStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import type { NodeId } from '@/types/nodeId'

const { t } = useI18n()
const commandStore = useCommandStore()
const linkSelectionStore = useLinkSelectionStore()
const canvasStore = useCanvasStore()
const { goToLinkDestination } = useLinkDestinationNavigation()
const goToControl = useTemplateRef<HTMLSpanElement>('goToControl')

const linksHidden = computed(() => {
  if (!linkSelectionStore.selection) return false
  const graph = canvasStore.canvas?.graph
  return !!graph && areSelectedLinksHidden(graph)
})

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
