<script setup lang="ts">
import { remove } from 'es-toolkit'
import { computed } from 'vue'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'

import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

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
    v-if="true"
    :class="
      cn(
        'col-span-2 grid grid-cols-subgrid items-stretch ring-primary-background rounded-lg pointer-events-auto **:cursor-pointer',
        isPromoted && 'ring-2'
      )
    "
    @pointerdown.capture.stop.prevent="togglePromotion"
    @click.capture.stop.prevent
    @pointerup.capture.stop.prevent
    @pointermove.capture.stop.prevent
  >
    <slot />
  </div>
  <slot v-else />
</template>
