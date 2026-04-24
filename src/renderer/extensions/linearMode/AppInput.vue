<script setup lang="ts">
import { useElementBounding, useRafFn } from '@vueuse/core'
import { remove } from 'es-toolkit'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { LinearInput } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useHideInputSelection } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

const { id, enable, name } = defineProps<{
  id: string
  enable: boolean
  name: string
}>()

const appModeStore = useAppModeStore()
const canvasStore = useCanvasStore()
const isPromoted = computed(() => appModeStore.selectedInputs.some(matchesThis))
// Ancestors (InputCell in the App Mode / App Builder floating panel) can
// opt out of the selection checkbox so the panel preview matches App Mode
// runtime 1:1. Selection + deselection in that context runs through the
// graph canvas or the ⋯ Remove menu on each cell's header.
const hideInputSelection = useHideInputSelection()
const showSelection = computed(() => enable && !hideInputSelection)

const wrapperRef = useTemplateRef<HTMLElement>('wrapper')
const { top, left, width, height, update } = useElementBounding(wrapperRef)
// Track canvas zoom so the checkbox cap scales with the rest of the
// widget — without this, a 32px cap stays a fixed screen size while the
// widgets around it shrink at low zoom, making capped checkboxes look
// disproportionately large.
const canvasScale = ref(1)

function tick() {
  update()
  canvasScale.value = canvasStore.canvas?.ds?.scale ?? 1
}
// Pan/zoom is applied as a CSS transform on TransformPane; the built-in
// resize/scroll/mutation observers never fire for it, so the bounds would
// drift away from the widget. A RAF loop (active only while the selection
// overlay is rendered) keeps the teleported ring glued on without having
// to subscribe to canvas transform state.
const { pause, resume } = useRafFn(tick, { immediate: false })
watch(showSelection, (show) => (show ? resume() : pause()), { immediate: true })

function matchesThis([nodeId, widgetName]: LinearInput) {
  // nodeId is NodeId (string | number) across the graph/store boundary;
  // normalize to string on both sides for a strict === comparison.
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
    <!--
      Ring + checkbox are teleported to <body> so they escape the
      TransformPane stacking context and paint above the builder
      select-mode scrim (which sits between the link overlay canvas and
      the Vue node layer). Positioned at the widget's viewport rect —
      width/height > 0 guards against the initial pre-mount 0-size flash.
    -->
    <Teleport v-if="width > 0 && height > 0" to="body">
      <div
        class="group pointer-events-auto fixed flex cursor-pointer flex-row items-stretch"
        :style="{
          top: `${top}px`,
          left:
            `calc(${left}px - ${1.5 * canvasScale}rem ` +
            `- var(--spacing-layout-gutter) * 4 * ${canvasScale})`,
          width:
            `calc(${width}px + ${1.5 * canvasScale}rem ` +
            `+ var(--spacing-layout-gutter) * 4 * ${canvasScale})`,
          height: `${height}px`,
          gap: `calc(var(--spacing-layout-gutter) * 2.5 * ${canvasScale})`,
          zIndex: 5
        }"
        @pointerdown.capture.stop.prevent="togglePromotion"
        @click.capture.stop.prevent
        @pointerup.capture.stop.prevent
        @pointermove.capture.stop.prevent
        @contextmenu.capture.stop.prevent
      >
        <div
          :style="{
            height: `${1.5 * canvasScale}rem`,
            width: `${1.5 * canvasScale}rem`
          }"
          :class="
            cn(
              'flex shrink-0 items-center justify-center self-center',
              'rounded-lg border-[3px] shadow-sm',
              isPromoted
                ? 'border-warning-background bg-warning-background'
                : [
                    'border-primary-background bg-base-background',
                    'group-hover:border-dashed group-hover:border-warning-background'
                  ]
            )
          "
        >
          <i
            v-if="isPromoted"
            class="bg-primary-foreground icon-[lucide--check] size-3/4"
          />
        </div>
        <div
          :class="
            cn(
              'pointer-events-none flex-1 self-stretch rounded-lg border-[3px]',
              isPromoted
                ? 'border-warning-background bg-warning-background/15'
                : [
                    'border-primary-background',
                    'group-hover:border-dashed group-hover:border-warning-background'
                  ]
            )
          "
        />
      </div>
    </Teleport>
  </div>
  <slot v-else />
</template>
