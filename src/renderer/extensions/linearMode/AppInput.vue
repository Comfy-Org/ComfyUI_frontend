<script setup lang="ts">
import { remove } from 'es-toolkit'
import { computed } from 'vue'

import type { LinearInput } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

const { id, name } = defineProps<{
  id: string
  enable: boolean
  name: string
}>()

const appModeStore = useAppModeStore()
const isPromoted = computed(() => appModeStore.selectedInputs.some(matchesThis))

function matchesThis([nodeId, widgetName]: LinearInput) {
  return id == nodeId && name === widgetName
}
function togglePromotion() {
  if (isPromoted.value) remove(appModeStore.selectedInputs, matchesThis)
  else appModeStore.selectedInputs.push([id, name])
}
</script>
<template>
  <div
    v-if="enable"
    class="pointer-events-auto relative col-span-2 flex cursor-pointer flex-row gap-1"
    @pointerdown.capture.stop.prevent="togglePromotion"
    @click.capture.stop.prevent
    @pointerup.capture.stop.prevent
    @pointermove.capture.stop.prevent
    @contextmenu.capture.stop.prevent
  >
    <div
      :class="
        cn(
          'm-1 size-4 self-center rounded-sm border border-primary-background',
          isPromoted && 'flex items-center bg-primary-background'
        )
      "
    >
      <i
        v-if="isPromoted"
        class="bg-primary-foreground place-center icon-[lucide--check]"
      />
    </div>
    <div
      :class="
        cn(
          'pointer-events-none grid flex-1 grid-cols-2 items-stretch rounded-lg ring-primary-background',
          isPromoted && 'ring-2'
        )
      "
    >
      <slot />
    </div>
    <div class="absolute size-full rounded-lg hover:bg-primary-background/10" />
  </div>
  <slot v-else />
</template>
