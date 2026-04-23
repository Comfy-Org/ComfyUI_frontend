<script setup lang="ts">
import { useElementBounding, useRafFn } from '@vueuse/core'
import { remove } from 'es-toolkit'
import { computed, useTemplateRef } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

const { id } = defineProps<{ id: string }>()

const appModeStore = useAppModeStore()
const isPromoted = computed(() =>
  appModeStore.selectedOutputs.some(matchesThis)
)

// Track the node's viewport rect via an in-place sizer. Pan/zoom is
// applied as a CSS transform on TransformPane and doesn't fire the
// built-in resize/scroll/mutation observers, so a RAF loop keeps the
// teleported ring glued to the node as the canvas transforms.
const wrapperRef = useTemplateRef<HTMLElement>('wrapper')
const { top, left, width, height, update } = useElementBounding(wrapperRef)
useRafFn(update, { immediate: true })

function matchesThis(nodeId: NodeId) {
  return id == nodeId
}
function togglePromotion() {
  if (isPromoted.value) remove(appModeStore.selectedOutputs, matchesThis)
  else appModeStore.selectedOutputs.push(id)
}
</script>
<template>
  <div ref="wrapper" class="pointer-events-none absolute inset-0" />
  <!--
    Ring + checkmark are teleported to <body> so they escape the
    Vue-node / TransformPane stacking context and paint above the
    builder select-mode scrim (which sits between the link overlay
    canvas and the Vue node layer). Colors mirror AppInput.vue:
    blue primary-background = selectable, orange warning-background +
    15% wash = selected — so input and output selection read as the
    same affordance.
  -->
  <Teleport v-if="width > 0 && height > 0" to="body">
    <div
      :class="
        cn(
          'group pointer-events-auto fixed cursor-pointer rounded-2xl outline-[5px] outline-solid',
          isPromoted
            ? 'bg-warning-background/15 outline-warning-background'
            : 'outline-primary-background hover:outline-warning-background hover:outline-dashed'
        )
      "
      :style="{
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 5
      }"
      @pointerdown.capture.stop.prevent="togglePromotion"
      @click.capture.stop.prevent
      @pointerup.capture.stop.prevent
      @pointermove.capture.stop.prevent
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
          class="absolute -top-1/2 -right-1/2 size-full rounded-lg border-4 border-primary-background bg-component-node-background group-hover:border-dashed group-hover:border-warning-background"
        />
      </div>
    </div>
  </Teleport>
</template>
