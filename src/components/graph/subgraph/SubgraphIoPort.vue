<script setup lang="ts">
import { computed } from 'vue'

import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import { cn } from '@comfyorg/tailwind-utils'

const { port, label } = defineProps<{
  port: SubgraphInput | SubgraphOutput
  label: string
}>()

const canvasStore = useCanvasStore()
const { state: linkDrag } = useSlotLinkDragUIState()

const isAddPort = computed(() => port === port.parent.emptySlot)
const testId = computed(() => {
  const direction =
    port.parent === port.parent.subgraph.inputNode ? 'input' : 'output'
  return isAddPort.value
    ? `subgraph-add-${direction}`
    : `subgraph-${direction}-port`
})
const dimmed = computed(() => {
  const from = linkDrag.active
    ? canvasStore.canvas?.linkConnector.renderLinks[0]?.fromSlot
    : undefined
  return !!from && !port.isValidTarget(from)
})
</script>

<template>
  <div
    data-port-anchor
    :data-testid="testId"
    :aria-label="isAddPort ? undefined : label"
    :class="
      cn(
        'lg-slot flex h-(--node-widget-height) w-0 shrink-0 cursor-crosshair items-center justify-center',
        dimmed && 'opacity-40'
      )
    "
  >
    <SlotConnectionDot class="shrink-0" :slot-data="port" />
  </div>
</template>
