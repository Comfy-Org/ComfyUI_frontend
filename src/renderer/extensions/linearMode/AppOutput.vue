<script setup lang="ts">
import { remove } from 'es-toolkit'
import { computed } from 'vue'

import { useAppModeStore } from '@/stores/appModeStore'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { cn } from '@comfyorg/tailwind-utils'

const { id } = defineProps<{ id: SerializedNodeId }>()

const appModeStore = useAppModeStore()
const parsedId = computed(() => parseNodeId(id))
const isPromoted = computed(() =>
  parsedId.value ? appModeStore.selectedOutputs.some(matchesThis) : false
)

function matchesThis(nodeId: NodeId) {
  return parsedId.value === nodeId
}
function togglePromotion() {
  if (!parsedId.value) return
  if (isPromoted.value) remove(appModeStore.selectedOutputs, matchesThis)
  else appModeStore.selectedOutputs.push(parsedId.value)
}
</script>
<template>
  <div
    :class="
      cn(
        'pointer-events-auto absolute z-1 size-full rounded-2xl ring-5 ring-warning-background/50',
        isPromoted && 'ring-warning-background'
      )
    "
    @click.capture.stop.prevent
    @pointerup.capture.stop.prevent
    @pointermove.capture.stop.prevent
    @pointerdown.capture.stop="togglePromotion"
    @contextmenu.capture.stop.prevent
  >
    <div class="absolute top-0 right-0 size-8">
      <div
        v-if="isPromoted"
        class="absolute -top-1/2 -right-1/2 size-full rounded-lg bg-warning-background p-2"
      >
        <i class="bg-text-foreground icon-[lucide--check] size-full" />
      </div>
      <div
        v-else
        class="absolute -top-1/2 -right-1/2 size-full rounded-lg bg-component-node-background ring-4 ring-warning-background/50 ring-inset"
      />
    </div>
  </div>
</template>
