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
// Ancestors (InputCell in the panel) can opt out of the selection
// checkbox so the panel preview matches App Mode 1:1; selection
// happens via the graph canvas there.
const hideInputSelection = useHideInputSelection()
const showSelection = computed(() => enable && !hideInputSelection)

const wrapperRef = useTemplateRef<HTMLElement>('wrapper')
const { top, left, width, height, update } = useElementBounding(wrapperRef)
// Track canvas zoom so the checkbox cap scales with the widget;
// without this a 32px cap looks oversized at low zoom.
const canvasScale = ref(1)

function tick() {
  update()
  canvasScale.value = canvasStore.canvas?.ds?.scale ?? 1
}
// TransformPane uses a CSS transform that resize/scroll/mutation
// observers don't fire for, so bounds drift. A RAF loop (only while
// the selection overlay is rendered) keeps the teleported ring glued
// on without subscribing to canvas transform state.
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
                ? 'border-(--color-app-mode-active-temp) bg-(--color-app-mode-active-temp)'
                : [
                    // Colors are TEMPORARY App Mode overrides — see
                    // definitions in LayoutView.vue.
                    'border-(--color-app-mode-accent-temp) bg-base-background',
                    'group-hover:border-dashed group-hover:border-(--color-app-mode-active-temp)'
                  ]
            )
          "
        >
          <!-- Inline SVG (instead of `icon-[lucide--check]`) so we can
               set `stroke-width="3"` directly. The bundled iconify
               lucide set only ships the default 2-stroke variant, and
               the icon is rendered as a 1-bit CSS mask which can't be
               thickened from the outside. -->
          <svg
            v-if="isPromoted"
            class="size-3/4 text-(--color-app-mode-active-temp-fg)"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div
          :class="
            cn(
              'pointer-events-none flex-1 self-stretch rounded-lg border-[3px]',
              isPromoted
                ? 'border-(--color-app-mode-active-temp) bg-(--color-app-mode-active-temp-wash)'
                : [
                    'border-(--color-app-mode-accent-temp)',
                    'group-hover:border-dashed group-hover:border-(--color-app-mode-active-temp)'
                  ]
            )
          "
        />
      </div>
    </Teleport>
  </div>
  <slot v-else />
</template>
