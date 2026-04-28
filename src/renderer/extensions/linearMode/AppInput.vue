<script setup lang="ts">
import { useElementBounding, useRafFn } from '@vueuse/core'
import { remove } from 'es-toolkit'
import { computed, useTemplateRef, watch } from 'vue'

import type { LinearInput } from '@/platform/workflow/management/stores/comfyWorkflow'
import SelectionChrome from '@/renderer/extensions/linearMode/SelectionChrome.vue'
import { useAppModeStore } from '@/stores/appModeStore'
import { useHideInputSelection } from '@/types/widgetTypes'

const { id, enable, name } = defineProps<{
  id: string
  enable: boolean
  name: string
}>()

const appModeStore = useAppModeStore()
const isPromoted = computed(() => appModeStore.selectedInputs.some(matchesThis))
// InputCell opts out so the panel preview matches App Mode 1:1
// (selection happens via the canvas overlay there).
const hideInputSelection = useHideInputSelection()
const showSelection = computed(() => enable && !hideInputSelection)

const wrapperRef = useTemplateRef<HTMLElement>('wrapper')
const { top, left, width, height, update } = useElementBounding(wrapperRef)
// TransformPane uses a CSS transform that resize/scroll observers
// don't fire for; RAF (gated to selection mode) keeps the teleported
// chrome glued to the widget rect.
const { pause, resume } = useRafFn(update, { immediate: false })
watch(showSelection, (s) => (s ? resume() : pause()), { immediate: true })

function matchesThis([nodeId, widgetName]: LinearInput) {
  // NodeId is string|number across graph/store; normalize both sides.
  return id === String(nodeId) && name === widgetName
}
function togglePromotion() {
  if (isPromoted.value) remove(appModeStore.selectedInputs, matchesThis)
  else appModeStore.selectedInputs.push([id, name])
}
</script>
<template>
  <div
    v-if="showSelection"
    ref="wrapper"
    class="col-span-2 grid grid-cols-2 items-stretch"
  >
    <slot />
    <SelectionChrome
      :is-selected="isPromoted"
      :top="top"
      :left="left"
      :width="width"
      :height="height"
      @toggle="togglePromotion"
    />
  </div>
  <slot v-else />
</template>
