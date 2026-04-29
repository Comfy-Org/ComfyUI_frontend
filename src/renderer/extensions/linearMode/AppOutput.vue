<script setup lang="ts">
import { useElementBounding, useRafFn } from '@vueuse/core'
import { remove } from 'es-toolkit'
import { computed, useTemplateRef } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import SelectionChrome from '@/renderer/extensions/linearMode/SelectionChrome.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { id } = defineProps<{ id: string }>()

const appModeStore = useAppModeStore()
const isPromoted = computed(() =>
  appModeStore.selectedOutputs.some(matchesThis)
)

// RAF keeps the teleported chrome glued to the node — TransformPane's
// CSS transform doesn't fire resize/scroll observers.
const wrapperRef = useTemplateRef<HTMLElement>('wrapper')
const { top, left, width, height, update } = useElementBounding(wrapperRef)
useRafFn(update, { immediate: true })

function matchesThis(nodeId: NodeId) {
  return id === String(nodeId)
}
function togglePromotion() {
  if (isPromoted.value) remove(appModeStore.selectedOutputs, matchesThis)
  else appModeStore.selectedOutputs.push(id)
}
</script>
<template>
  <div ref="wrapper" class="pointer-events-none absolute inset-0" />
  <SelectionChrome
    :is-selected="isPromoted"
    :top="top"
    :left="left"
    :width="width"
    :height="height"
    @toggle="togglePromotion"
  />
</template>
