<script setup lang="ts">
import { remove } from 'es-toolkit'
import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

const { mode } = useAppMode()
const appModeStore = useAppModeStore()

const { id, name } = defineProps<{ id: string; name: string }>()

const isPromoted = computed(() => appModeStore.selectedInputs.some(matchesThis))

function matchesThis([nodeId, widgetName]: [NodeId, string]) {
  return id == nodeId && name === widgetName
}
function togglePromotion() {
  if (isPromoted.value) remove(appModeStore.selectedInputs, matchesThis)
  else appModeStore.selectedInputs.push([id, name])
}
</script>
<template>
  <div
    v-if="mode === 'builder:select'"
    class="col-span-2 flex flex-row pointer-events-auto cursor-pointer gap-1 relative"
    @pointerdown.capture.stop.prevent="togglePromotion"
    @click.capture.stop.prevent
    @pointerup.capture.stop.prevent
    @pointermove.capture.stop.prevent
  >
    <div
      :class="
        cn(
          'border-primary-background border rounded-sm size-4 self-center m-1',
          isPromoted && 'bg-primary-background flex items-center'
        )
      "
    >
      <i
        v-if="isPromoted"
        class="icon-[lucide--check] bg-primary-foreground place-center"
      />
    </div>
    <div
      :class="
        cn(
          'grid grid-cols-2 items-stretch ring-primary-background rounded-lg pointer-events-none flex-1',
          isPromoted && 'ring-2'
        )
      "
    >
      <slot />
    </div>
    <div class="absolute size-full hover:bg-primary-background/10 rounded-lg" />
  </div>
  <slot v-else />
</template>
