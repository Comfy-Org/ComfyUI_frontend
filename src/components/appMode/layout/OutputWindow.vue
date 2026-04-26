<script setup lang="ts">
/**
 * OutputWindow — movable card containing one generation's output
 * (skeleton / latent / final image, in that order via crossfade).
 *
 * Visually mirrors FloatingPanel (same panel-chrome surface, same
 * header layout: chevron / title / menu) but with freeform drag
 * instead of snap-to-preset.
 *
 * Lives INSIDE LayoutView's workspace transform — that's why the
 * window scales + pans with zoom. Position is stored in workspace
 * coordinates; drag deltas are divided by the live viewport scale
 * so 1px of mouse movement = 1px of workspace movement regardless
 * of zoom. Drag pointerdown stops propagation so the workspace's
 * own pan handler on `bgRef` doesn't also fire.
 */
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const { width = 512, height = 568 } = defineProps<{
  width?: number
  height?: number
}>()

const appModeStore = useAppModeStore()
const { viewportScale } = storeToRefs(appModeStore)

// Snap pitch — finer than the visible dot grid (24px) so even small
// drags snap to a clean increment for alignment, while staying coarse
// enough that the snap feels intentional rather than the cursor
// fighting the user.
const GRID = 8
const snap = (v: number) => Math.round(v / GRID) * GRID

const wx = ref(0)
const wy = ref(0)
const dragging = ref(false)

onMounted(() => {
  // Initial position: roughly screen-center in workspace coords.
  // Holds at scale=1 / no pan; if the user has zoomed/panned away
  // before the window appears it'll land wherever the corresponding
  // workspace coord lives — they can drag it.
  wx.value = snap(Math.max(0, (window.innerWidth - width) / 2))
  wy.value = snap(Math.max(0, (window.innerHeight - height) / 2 - 32))
})

let dragStart: { px: number; py: number; bx: number; by: number } | null = null

function handleHeaderPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  // Stop bubbling so LayoutView's bgRef pan handler doesn't also
  // start a workspace pan from this same press.
  e.stopPropagation()
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragStart = { px: e.clientX, py: e.clientY, bx: wx.value, by: wy.value }
  dragging.value = true
}

useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!dragStart) return
  // Pointer moves in screen px; window position is workspace px.
  // Divide by scale so the cursor stays "stuck" to the header
  // regardless of zoom level.
  const s = viewportScale.value || 1
  wx.value = dragStart.bx + (e.clientX - dragStart.px) / s
  wy.value = dragStart.by + (e.clientY - dragStart.py) / s
})

function endDrag() {
  if (dragStart) {
    wx.value = snap(wx.value)
    wy.value = snap(wy.value)
  }
  dragStart = null
  dragging.value = false
}
useEventListener(window, 'pointerup', endDrag)
useEventListener(window, 'pointercancel', endDrag)

const HEADER_CONTROL_CLASS =
  'inline-flex size-8 cursor-pointer items-center justify-center ' +
  'rounded-md border-0 bg-transparent text-layout-text ' +
  'transition-colors duration-layout ease-layout ' +
  'hover:bg-layout-cell-hover [&>i]:size-[18px]'
</script>

<template>
  <section
    class="panel-chrome floating-panel pointer-events-auto absolute z-30 flex flex-col overflow-hidden"
    :style="{
      left: `${wx}px`,
      top: `${wy}px`,
      width: `${width}px`,
      height: `${height}px`
    }"
  >
    <!-- Header strip mirrors FloatingPanel: chevron / title / menu,
         the strip itself is the drag grip. The two buttons stop
         propagation so a click on them doesn't start a drag. -->
    <header
      :class="[
        'flex min-h-layout-cell items-center gap-2 select-none',
        'bg-(--color-layout-header-fill) px-[10px] py-2',
        'cursor-grab touch-none',
        dragging && 'cursor-grabbing'
      ]"
      @pointerdown="handleHeaderPointerDown"
    >
      <button
        type="button"
        data-header-control
        :class="HEADER_CONTROL_CLASS"
        @pointerdown.stop
      >
        <i class="icon-[lucide--chevron-down]" />
      </button>
      <span class="truncate text-layout-md font-semibold text-layout-text">
        {{ t('linearMode.outputs.title') }}
      </span>
      <div class="min-w-0 flex-1" />
      <button
        type="button"
        data-header-control
        :class="HEADER_CONTROL_CLASS"
        @pointerdown.stop
      >
        <i class="icon-[lucide--ellipsis]" />
      </button>
    </header>
    <div class="group/output relative min-h-0 flex-1 overflow-hidden">
      <slot />
    </div>
  </section>
</template>
