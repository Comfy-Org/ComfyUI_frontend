<script setup lang="ts">
import { useElementBounding, useRafFn } from '@vueuse/core'
import { computed, useTemplateRef, watch } from 'vue'

import SelectionChrome from '@/renderer/extensions/linearMode/SelectionChrome.vue'
import { useAppModeStore } from '@/stores/appModeStore'
import { useHideInputSelection } from '@/types/widgetTypes'

const { id, enable, name } = defineProps<{
  id: string
  enable: boolean
  name: string
}>()

const appModeStore = useAppModeStore()
const isPromoted = computed(() =>
  appModeStore.selectedInputs.some(
    ([nodeId, widgetName]) => id === String(nodeId) && name === widgetName
  )
)
const hideInputSelection = useHideInputSelection()
const showSelection = computed(() => enable && !hideInputSelection)

const wrapperRef = useTemplateRef<HTMLElement>('wrapper')
const { top, left, width, height, update } = useElementBounding(wrapperRef)
// RAF keeps teleported chrome glued to the widget — TransformPane's
// CSS transform doesn't fire resize/scroll observers.
const { pause, resume } = useRafFn(update, { immediate: false })
watch(showSelection, (s) => (s ? resume() : pause()), { immediate: true })

function togglePromotion() {
  appModeStore.toggleSelectedInput(id, name)
}
</script>
<template>
  <!-- Single render path; toggle wrapper styling instead of swapping
       trees so the slotted widget doesn't unmount/remount on every
       selection-mode flip (would drop input focus + any widget-local
       state). `contents` makes the wrapper transparent to layout. -->
  <div
    ref="wrapper"
    :class="
      showSelection ? 'col-span-2 grid grid-cols-2 items-stretch' : 'contents'
    "
  >
    <slot />
    <SelectionChrome
      v-if="showSelection"
      :is-selected="isPromoted"
      :top="top"
      :left="left"
      :width="width"
      :height="height"
      @toggle="togglePromotion"
    />
  </div>
</template>
