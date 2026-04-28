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

// TransformPane uses a CSS transform that resize/scroll observers don't
// fire for, so a RAF loop keeps the teleported chrome glued to the node
// rect as the canvas pans/zooms. Bounded by mount: AppOutput renders
// only while `isSelectOutputsMode` is true (see LGraphNode.vue).
//
// Known follow-up (CR): with many output nodes visible, each instance
// runs its own RAF callback. A shared dispatcher driving all
// AppInput/AppOutput updates would reduce per-frame work — out of scope.
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
