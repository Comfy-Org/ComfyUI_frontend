<script setup lang="ts">
import { remove } from 'es-toolkit'
import { computed } from 'vue'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'

import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

const { isSelectMode } = useAppMode()
const appModeStore = useAppModeStore()

const { id } = defineProps<{ id: string }>()

const isPromoted = computed(() =>
  appModeStore.selectedOutputs.some(matchesThis)
)

function matchesThis(nodeId: NodeId) {
  return id == nodeId
}
function togglePromotion() {
  if (isPromoted.value) remove(appModeStore.selectedOutputs, matchesThis)
  else appModeStore.selectedOutputs.push(id)
}
</script>
<template>
  <div
    v-if="isSelectMode"
    :class="
      cn(
        'absolute w-full h-full pointer-events-auto ring-warning-background/50 ring-5 rounded-2xl',
        isPromoted && 'ring-warning-background'
      )
    "
    @click.capture.stop.prevent
    @pointerup.capture.stop.prevent
    @pointermove.capture.stop.prevent
    @pointerdown.capture="togglePromotion"
  >
    <div class="absolute top-0 right-0 size-8">
      <div
        v-if="isPromoted"
        class="absolute -top-1/2 -right-1/2 size-full p-2 bg-warning-background rounded-lg"
      >
        <i class="icon-[lucide--check] bg-text-foreground size-full" />
      </div>
      <div
        v-else
        class="absolute -top-1/2 -right-1/2 size-full ring-warning-background/50 ring-4 ring-inset bg-component-node-background rounded-lg"
      />
    </div>
  </div>
</template>
