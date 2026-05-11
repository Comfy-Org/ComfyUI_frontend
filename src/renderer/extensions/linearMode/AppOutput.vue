<script setup lang="ts">
import { useElementBounding, useRafFn } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import SelectionChrome from '@/renderer/extensions/linearMode/SelectionChrome.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { id } = defineProps<{ id: string }>()

const appModeStore = useAppModeStore()
const isPromoted = computed(() =>
  appModeStore.selectedOutputs.some((nodeId) => id === String(nodeId))
)

// RAF keeps the teleported chrome glued to the node — TransformPane's
// CSS transform doesn't fire resize/scroll observers.
const wrapperRef = useTemplateRef<HTMLElement>('wrapper')
const { top, left, width, height, update } = useElementBounding(wrapperRef)
useRafFn(update, { immediate: true })

function togglePromotion() {
  appModeStore.toggleSelectedOutput(id)
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
