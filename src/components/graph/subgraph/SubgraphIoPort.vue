<script setup lang="ts">
import { computed } from 'vue'

import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import { cn } from '@comfyorg/tailwind-utils'

const { port } = defineProps<{ port: SubgraphInput | SubgraphOutput }>()

const canvasStore = useCanvasStore()
const { state: linkDrag } = useSlotLinkDragUIState()
const { forwardEventToCanvas } = useCanvasInteractions()

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
    :class="
      cn(
        'lg-slot flex h-(--node-widget-height) w-0 shrink-0 cursor-crosshair items-center justify-center',
        dimmed && 'opacity-40'
      )
    "
    @pointerdown="forwardEventToCanvas"
    @pointermove="forwardEventToCanvas"
    @pointerup="forwardEventToCanvas"
    @dblclick="forwardEventToCanvas"
    @contextmenu.prevent
  >
    <SlotConnectionDot class="shrink-0" :slot-data="port" />
  </div>
</template>
